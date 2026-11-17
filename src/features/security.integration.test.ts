import "../test/env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../test/db";
import { MemoryRateLimitStore } from "../lib/rate-limit";
import { OTP_RATE_LIMITS } from "../lib/constants";
import { PhaseError } from "./event/phase";
import { finalizeMatching, simulateMatching } from "./matching/service";
import { createProfileRecord, updateProfileRecord } from "./profile/service";
import { addJokerRecord, purgeAllRecords, removeJokerRecord, startEventDayRecord } from "./admin/service";
import { checkInTicket, undoCheckInTicket } from "./checkin/service";
import { createOtpLimiters, requestOtpCore, verifyOtpCore, type OtpDeps } from "./auth/otp-service";
import type { ProfileInput } from "./profile/schemas";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

const INTERESTS = ["kitap", "kahve", "oyun", "muzik", "yazilim", "sinema", "anime"] as const;

function profile(i: number, tier: ProfileInput["budgetTier"] = "TIER_300_450"): ProfileInput {
  return {
    alias: `Test Geyik ${i}`,
    avatarId: "geyik",
    budgetTier: tier,
    interests: [INTERESTS[i % 7]!, INTERESTS[(i + 1) % 7]!, INTERESTS[(i + 2) % 7]!],
    giftHints: "",
    giftExclusions: "",
  };
}

async function seedProfiles(db: Db, count: number, offset = 0) {
  for (let i = offset; i < offset + count; i++) {
    const out = await createProfileRecord(db, `ref-${i}`, profile(i));
    assert.equal(out.status, "created");
  }
}

async function withDb(fn: (db: Db) => Promise<void>, opts?: { seedSettings?: boolean }) {
  const t = await createTestDb(opts);
  try {
    await fn(t.db);
  } finally {
    await t.cleanup();
  }
}

/** Promise sonucu ya da yakalanan PhaseError (diğer hatalar testi düşürür). */
async function settle<T>(p: Promise<T>): Promise<T | PhaseError> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof PhaseError) return err;
    throw err;
  }
}

async function phaseOf(db: Db) {
  return (await db.eventSettings.findUniqueOrThrow({ where: { id: 1 } })).phase;
}

/** Her profil tam olarak bir kez verir ve bir kez alır (eşleşme dışında kalan profil yok). */
async function assertEveryoneMatched(db: Db) {
  const [profiles, matches, unmatchedGivers, unmatchedReceivers] = await Promise.all([
    db.participantProfile.count(),
    db.match.count(),
    db.participantProfile.count({ where: { givingMatch: null } }),
    db.participantProfile.count({ where: { receivingMatch: null } }),
  ]);
  assert.equal(matches, profiles, "eşleşme sayısı = profil sayısı");
  assert.equal(unmatchedGivers, 0, "hediye vermeyen profil kalmamalı");
  assert.equal(unmatchedReceivers, 0, "hediye almayan profil kalmamalı");
}

// ── 4. Yarış koşulları: faz kontrolü + yazma atomik ─────────────────────────────

test("yarış: eşleştirme kesinleşirken eşzamanlı profil oluşturma havuza sızamaz", async () => {
  for (let round = 0; round < 6; round++) {
    await withDb(async (db) => {
      await seedProfiles(db, 4);
      const tasks: Array<() => Promise<unknown>> = Array.from(
        { length: 6 },
        (_, k) => () => settle(createProfileRecord(db, `late-${round}-${k}`, profile(100 + k))),
      );
      // Kesinleştirmeyi her turda farklı sırada başlat (önce / arada / sonda).
      tasks.splice(round % 7, 0, () => settle(finalizeMatching(db)));
      const results = await Promise.all(tasks.map((run) => run()));

      assert.equal(await phaseOf(db), "MATCHED");
      await assertEveryoneMatched(db);
      for (const r of results) {
        if (r instanceof PhaseError) assert.equal(r.reason, "wrong_phase");
      }
      // Eşleştirmeden sonra profil oluşturma kesin olarak reddedilir.
      await assert.rejects(createProfileRecord(db, "cok-gec", profile(999)), PhaseError);
    });
  }
});

test("yarış: aynı anda iki 'kesinleştir' — yalnızca biri başarılı, tek denetim kaydı", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 6);
    const results = await Promise.all([settle(finalizeMatching(db)), settle(finalizeMatching(db))]);
    assert.equal(results.filter((r) => r instanceof PhaseError).length, 1);
    assert.equal(results.filter((r) => !(r instanceof PhaseError) && r.isValid).length, 1);
    assert.equal(await db.auditLog.count({ where: { action: "MATCHES_FINALIZED" } }), 1);
    await assertEveryoneMatched(db);
  });
});

test("yarış: joker ekleme/çıkarma ile eşleştirme aynı kilidi paylaşır", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 3);
    const results = await Promise.all([
      settle(addJokerRecord(db, "TIER_300_450")),
      settle(finalizeMatching(db)),
      settle(addJokerRecord(db, "TIER_300_450")),
    ]);
    assert.equal(await phaseOf(db), "MATCHED");
    await assertEveryoneMatched(db); // eklenen joker(ler) mutlaka eşleşmede
    assert.ok(results.some((r) => r instanceof PhaseError) || (await db.participantProfile.count({ where: { isJoker: true } })) === 2);

    const joker = await db.participantProfile.findFirst({ where: { isJoker: true } });
    if (joker) await assert.rejects(removeJokerRecord(db, joker.id), PhaseError, "eşleştirmeden sonra joker silinemez");
    await assert.rejects(addJokerRecord(db, "TIER_300_450"), PhaseError);
  });
});

test("yarış: iki eşzamanlı bilet modu geçişinden yalnızca biri uygulanır", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 4);
    await finalizeMatching(db);
    const results = await Promise.all([settle(startEventDayRecord(db)), settle(startEventDayRecord(db))]);
    assert.equal(results.filter((r) => r instanceof PhaseError).length, 1);
    assert.equal(await phaseOf(db), "EVENT_DAY");
    assert.equal(await db.auditLog.count({ where: { action: "EVENT_DAY_STARTED" } }), 1);
  });
});

test("faz kuralları: profil güncelleme, simülasyon ve bilet modu yanlış fazda reddedilir", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 4);
    await assert.rejects(startEventDayRecord(db), PhaseError, "MATCHED olmadan bilet modu yok");
    assert.equal((await updateProfileRecord(db, "ref-0", { ...profile(0), giftHints: "kupa" })).status, "updated");
    await finalizeMatching(db);
    await assert.rejects(updateProfileRecord(db, "ref-0", profile(0)), PhaseError);
    await assert.rejects(simulateMatching(db), PhaseError);
  });
});

test("check-in: eşzamanlı iki okutmada biri 'ok' diğeri 'already'", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 4);
    await finalizeMatching(db);
    const { ticketCode } = await db.participantProfile.findFirstOrThrow();
    await assert.rejects(checkInTicket(db, ticketCode), PhaseError, "EVENT_DAY öncesi check-in yok");
    await startEventDayRecord(db);

    const results = await Promise.all([checkInTicket(db, ticketCode), checkInTicket(db, ticketCode)]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["already", "ok"]);
    assert.equal((await checkInTicket(db, "ZZZZZZ")).status, "not_found");
  });
});

// ── 6. undoCheckIn yalnızca EVENT_DAY ───────────────────────────────────────────

test("check-in geri alma yalnızca EVENT_DAY fazında; CLOSED ve diğer fazlarda reddedilir", async () => {
  await withDb(async (db) => {
    await seedProfiles(db, 4);
    const { ticketCode } = await db.participantProfile.findFirstOrThrow();
    await assert.rejects(undoCheckInTicket(db, ticketCode), PhaseError, "REGISTRATION");

    await finalizeMatching(db);
    await assert.rejects(undoCheckInTicket(db, ticketCode), PhaseError, "MATCHED");

    await startEventDayRecord(db);
    await checkInTicket(db, ticketCode);
    assert.equal(await undoCheckInTicket(db, ticketCode), true);
    assert.equal(await undoCheckInTicket(db, ticketCode), false, "zaten geri alınmış");
    await checkInTicket(db, ticketCode);

    // Etkinlik kapandı (imha öncesi kapanış senaryosu): geri alma kesin olarak reddedilir.
    await db.eventSettings.update({ where: { id: 1 }, data: { phase: "CLOSED" } });
    await assert.rejects(undoCheckInTicket(db, ticketCode), (err: unknown) => {
      return err instanceof PhaseError && err.reason === "wrong_phase" && err.phase === "CLOSED";
    });
    const p = await db.participantProfile.findUniqueOrThrow({ where: { ticketCode } });
    assert.equal(p.isCheckedIn, true, "giriş kaydı değişmedi");
  });
});

// ── 5. Ayar satırı yoksa varsayılan faz VARSAYILMAZ ─────────────────────────────

test("eventSettings kaydı yoksa profil, joker, eşleştirme, check-in ve imha reddedilir", async () => {
  await withDb(
    async (db) => {
      const missing = (err: unknown) => err instanceof PhaseError && err.reason === "missing_settings";
      await assert.rejects(createProfileRecord(db, "ref-x", profile(1)), missing);
      await assert.rejects(updateProfileRecord(db, "ref-x", profile(1)), missing);
      await assert.rejects(addJokerRecord(db, "TIER_300_450"), missing);
      await assert.rejects(removeJokerRecord(db, "yok"), missing);
      await assert.rejects(simulateMatching(db), missing);
      await assert.rejects(finalizeMatching(db), missing);
      await assert.rejects(startEventDayRecord(db), missing);
      await assert.rejects(checkInTicket(db, "ABCDEF"), missing);
      await assert.rejects(undoCheckInTicket(db, "ABCDEF"), missing);
      await assert.rejects(purgeAllRecords(db), missing);
      assert.equal(await db.participantProfile.count(), 0, "hiçbir şey yazılmadı");

      const deps = otpDeps(db);
      assert.equal((await requestOtpCore(deps, "ali@ogr.hacettepe.edu.tr")).status, "missing_settings");
      assert.equal((await verifyOtpCore(deps, "ali@ogr.hacettepe.edu.tr", "123456")).status, "missing_settings");
      assert.equal(await db.authIdentity.count(), 0);
      assert.equal(deps.sent.length, 0);
    },
    { seedSettings: false },
  );
});

// ── 8. İmha: denetim kaydı + oturum dönemi ──────────────────────────────────────

test("imha tüm kişisel verileri siler, oturum dönemini artırır ve kişisel veri içermeyen denetim kaydı bırakır", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    await requestOtpCore(deps, "ali@ogr.hacettepe.edu.tr");
    await seedProfiles(db, 4);
    await finalizeMatching(db);
    await startEventDayRecord(db);
    const before = await db.eventSettings.findUniqueOrThrow({ where: { id: 1 } });

    const counts = await purgeAllRecords(db);
    assert.deepEqual(counts, { identities: 1, profiles: 4, interests: 12, matches: 4 });

    const after = await db.eventSettings.findUniqueOrThrow({ where: { id: 1 } });
    assert.equal(after.phase, "CLOSED");
    assert.ok(after.dataPurgedAt);
    assert.equal(after.sessionEpoch, before.sessionEpoch + 1, "eski oturumlar geçersizleşir");
    for (const n of await Promise.all([
      db.authIdentity.count(),
      db.participantProfile.count(),
      db.profileInterest.count(),
      db.match.count(),
    ])) {
      assert.equal(n, 0);
    }

    const logs = await db.auditLog.findMany({ orderBy: { id: "asc" } });
    assert.deepEqual(
      logs.map((l) => l.action),
      ["MATCHES_FINALIZED", "EVENT_DAY_STARTED", "DATA_PURGED"],
    );
    for (const l of logs) {
      assert.match(l.detail, /^([a-z_]+=\d+)( [a-z_]+=\d+)*$/i, "detay yalnızca sayısal özet");
      assert.ok(!/@|geyik|ref-/i.test(l.detail), "kişisel/tekil veri yok");
    }

    // İmhadan sonra giriş yapılamaz.
    assert.equal((await requestOtpCore(deps, "ali@ogr.hacettepe.edu.tr")).status, "event_closed");
  });
});

// ── 3. OTP hız sınırları ────────────────────────────────────────────────────────

function otpDeps(db: Db, opts: { ip?: string } = {}) {
  const clock = { now: Date.parse("2026-12-01T10:00:00Z") };
  const store = new MemoryRateLimitStore(() => clock.now);
  const sent: Array<{ email: string; code: string }> = [];
  const deps: OtpDeps & { clock: typeof clock; sent: typeof sent } = {
    db,
    ip: opts.ip ?? "10.0.0.1",
    limiters: createOtpLimiters({ store, now: () => clock.now }),
    sendOtp: async (email, code) => {
      sent.push({ email, code });
    },
    now: () => clock.now,
    clock,
    sent,
  };
  return deps;
}

test("OTP isteme: IP başına 15 dakikada 10 istek", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    const limit = OTP_RATE_LIMITS.requestPerIp.limit;
    for (let i = 0; i < limit; i++) {
      assert.equal((await requestOtpCore(deps, `ogrenci${i}@ogr.hacettepe.edu.tr`)).status, "sent");
    }
    const blocked = await requestOtpCore(deps, "baska@ogr.hacettepe.edu.tr");
    assert.equal(blocked.status, "rate_limited");
    assert.equal(blocked.status === "rate_limited" && blocked.scope, "ip");
    assert.equal(deps.sent.length, limit, "engellenen istek için e-posta gitmez");

    // Başka IP etkilenmez; pencere dolunca açılır.
    assert.equal((await requestOtpCore({ ...deps, ip: "10.0.0.2" }, "baska@ogr.hacettepe.edu.tr")).status, "sent");
    deps.clock.now += OTP_RATE_LIMITS.requestPerIp.windowMs;
    assert.equal((await requestOtpCore(deps, "yeni@ogr.hacettepe.edu.tr")).status, "sent");
  });
});

test("OTP isteme: aynı e-postaya 60 sn bekleme ve 24 saatte en fazla 5 kod", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    const email = "ali@ogr.hacettepe.edu.tr";
    assert.equal((await requestOtpCore(deps, email)).status, "sent");
    assert.equal((await requestOtpCore(deps, email)).status, "cooldown", "60 sn dolmadan");

    for (let i = 1; i < OTP_RATE_LIMITS.requestPerEmail.limit; i++) {
      deps.clock.now += 61_000;
      // IP sınırına takılmamak için her istek farklı IP'den (e-posta katmanı ayrı test edilsin).
      assert.equal((await requestOtpCore({ ...deps, ip: `10.1.0.${i}` }, email)).status, "sent", `#${i + 1}`);
    }
    deps.clock.now += 61_000;
    const blocked = await requestOtpCore({ ...deps, ip: "10.2.0.1" }, email);
    assert.equal(blocked.status === "rate_limited" && blocked.scope, "email");
    assert.equal(deps.sent.length, OTP_RATE_LIMITS.requestPerEmail.limit);

    deps.clock.now += OTP_RATE_LIMITS.requestPerEmail.windowMs;
    assert.equal((await requestOtpCore({ ...deps, ip: "10.2.0.2" }, email)).status, "sent", "24 saat sonra açılır");
  });
});

test("OTP isteme: aynı adres için eşzamanlı istekler tek kod üretir (atomik bekleme süresi)", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    const email = "yaris@ogr.hacettepe.edu.tr";
    const first = await Promise.all(Array.from({ length: 5 }, () => requestOtpCore(deps, email)));
    assert.equal(first.filter((r) => r.status === "sent").length, 1, "yeni kimlik");
    assert.equal(await db.authIdentity.count(), 1);

    deps.clock.now += 61_000;
    const second = await Promise.all(Array.from({ length: 5 }, () => requestOtpCore(deps, email)));
    assert.equal(second.filter((r) => r.status === "sent").length, 1, "mevcut kimlik");
    assert.equal(deps.sent.length, 2);
  });
});

test("OTP doğrulama: IP ve hesap bazlı sınır, yeni kod istense de hesap sınırı sıfırlanmaz", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    const email = "ali@ogr.hacettepe.edu.tr";
    const perEmail = OTP_RATE_LIMITS.verifyPerEmail.limit;

    // Saldırgan: kod iste → 5 yanlış dene → yeni kod iste … (kod başına 5 sınırını aşmaya çalışır)
    let attempts = 0;
    let blocked: Awaited<ReturnType<typeof verifyOtpCore>> | null = null;
    for (let round = 0; round < 10 && !blocked; round++) {
      deps.clock.now += 61_000;
      await requestOtpCore({ ...deps, ip: `10.3.0.${round}` }, email);
      for (let i = 0; i < 5; i++) {
        const r = await verifyOtpCore({ ...deps, ip: `10.4.${round}.${i}` }, email, "000000");
        if (r.status === "rate_limited") {
          blocked = r;
          break;
        }
        attempts++;
      }
    }
    assert.equal(attempts, perEmail, "hesap başına sınır");
    assert.equal(blocked?.status === "rate_limited" && blocked.scope, "email");

    // IP katmanı: tek IP'den farklı hesaplar için deneme.
    const ipDeps = otpDeps(db, { ip: "10.9.9.9" });
    const perIp = OTP_RATE_LIMITS.verifyPerIp.limit;
    for (let i = 0; i < perIp; i++) {
      assert.notEqual((await verifyOtpCore(ipDeps, `x${i}@ogr.hacettepe.edu.tr`, "000000")).status, "rate_limited");
    }
    const ipBlocked = await verifyOtpCore(ipDeps, "son@ogr.hacettepe.edu.tr", "000000");
    assert.equal(ipBlocked.status === "rate_limited" && ipBlocked.scope, "ip");
  });
});

test("OTP doğrulama: doğru kod bir kez geçer, kod başına 5 yanlış deneme sınırı korunur", async () => {
  await withDb(async (db) => {
    const deps = otpDeps(db);
    const email = "veli@ogr.hacettepe.edu.tr";
    await requestOtpCore(deps, email);
    const code = deps.sent.at(-1)!.code;
    const wrong = code === "000000" ? "111111" : "000000";

    const r1 = await verifyOtpCore(deps, email, wrong);
    assert.deepEqual(r1, { status: "wrong_code", attemptsLeft: 4 });
    const ok = await verifyOtpCore(deps, email, code);
    assert.equal(ok.status, "verified");
    assert.equal((await verifyOtpCore(deps, email, code)).status, "invalid", "tek kullanımlık");

    deps.clock.now += 61_000;
    await requestOtpCore(deps, email);
    const fresh = deps.sent.at(-1)!.code;
    const bad = fresh === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await verifyOtpCore(deps, email, bad);
    assert.equal((await verifyOtpCore(deps, email, fresh)).status, "too_many_attempts");

    deps.clock.now += 11 * 60_000;
    assert.equal((await verifyOtpCore(deps, email, fresh)).status, "expired");
  });
});
