import type { Prisma, PrismaClient } from "../../generated/prisma/client";

/**
 * Faz denetimi ve faz geçişleri — atomik.
 *
 * Eski kalıp "önce fazı oku, sonra ayrı sorguyla yaz" iki istek arasında faz değişirse
 * (ör. eşleştirme kesinleşirken yeni profil oluşturulması) tutarsızlığa yol açıyordu.
 * Yeni kalıp: fazı koşul alan her yazma `db.$transaction` içinde ÖNCE bu modüldeki
 * `lockPhase()` / `transitionPhase()` ile `event_settings` satırını koşullu günceller:
 *
 *   UPDATE event_settings SET lock_version = lock_version + 1 WHERE id = 1 AND phase IN (…)
 *
 * - PostgreSQL: UPDATE satır kilidi alır ve transaction bitene kadar tutar. Eşzamanlı bir faz
 *   geçişi bu satırı güncellemek için bekler; READ COMMITTED'da beklemeden sonra WHERE koşulu
 *   satırın yeni hâli üzerinde yeniden değerlendirilir, dolayısıyla faz değiştiyse 0 satır döner.
 * - Testlerdeki PGlite tek oturumludur; transaction'lar zaten sırayla çalışır.
 *
 * Böylece "faz uygun mu?" kontrolü ile asıl yazma aynı kilit altında, bölünmez olur.
 */

export type EventPhase = "REGISTRATION" | "MATCHED" | "EVENT_DAY" | "CLOSED";

/** `$transaction` içindeki istemci ya da üst düzey istemci. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export type PhaseErrorReason = "missing_settings" | "wrong_phase";

export class PhaseError extends Error {
  constructor(
    readonly reason: PhaseErrorReason,
    readonly phase: EventPhase | null,
  ) {
    super(
      reason === "missing_settings"
        ? "Etkinlik ayarları bulunamadı. Yönetici `npm run db:seed` çalıştırmalı."
        : `Bu işlem şu anki fazda (${phase}) yapılamaz.`,
    );
    this.name = "PhaseError";
  }
}

export const MISSING_SETTINGS_MESSAGE = "Etkinlik henüz yapılandırılmadı. Lütfen daha sonra tekrar dene.";

async function explainFailure(tx: DbClient): Promise<PhaseError> {
  const s = await tx.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  return s ? new PhaseError("wrong_phase", s.phase) : new PhaseError("missing_settings", null);
}

/**
 * Faz `allowed` içindeyse satırı kilitler ve fazı döndürür; değilse `PhaseError` fırlatır.
 * Ayar satırı yoksa varsayılan faz VARSAYILMAZ — işlem reddedilir.
 * Mutlaka bir `$transaction` içinde, diğer yazmalardan ÖNCE çağrılmalı.
 */
export async function lockPhase(tx: DbClient, allowed: readonly EventPhase[]): Promise<EventPhase> {
  const { count } = await tx.eventSettings.updateMany({
    where: { id: 1, phase: { in: [...allowed] } },
    data: { lockVersion: { increment: 1 } },
  });
  if (count === 0) throw await explainFailure(tx);
  const s = await tx.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  return s!.phase;
}

/** Ayar satırının varlığını doğrular (faz fark etmeksizin) ve kilitler. */
export async function lockSettings(tx: DbClient): Promise<EventPhase> {
  return lockPhase(tx, ["REGISTRATION", "MATCHED", "EVENT_DAY", "CLOSED"]);
}

/**
 * Koşullu faz geçişi: yalnızca faz hâlâ `from` ise `to` yapılır. Aksi hâlde `PhaseError`.
 * İki yönetici aynı anda "kesinleştir"e basarsa yalnızca biri başarılı olur.
 */
export async function transitionPhase(
  tx: DbClient,
  from: EventPhase,
  to: EventPhase,
  extra: Omit<Prisma.EventSettingsUpdateManyMutationInput, "phase" | "lockVersion"> = {},
): Promise<void> {
  const { count } = await tx.eventSettings.updateMany({
    where: { id: 1, phase: from },
    data: { ...extra, phase: to, lockVersion: { increment: 1 } },
  });
  if (count === 0) throw await explainFailure(tx);
}

/** Salt okuma: ayar satırı yoksa `PhaseError("missing_settings")`. */
export async function readPhase(client: DbClient): Promise<EventPhase> {
  const s = await client.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (!s) throw new PhaseError("missing_settings", null);
  return s.phase;
}

// ── Denetim kaydı ────────────────────────────────────────────

export type AuditAction = "MATCHES_FINALIZED" | "EVENT_DAY_STARTED" | "DATA_PURGED";

/**
 * Kişisel veri İÇERMEYEN denetim kaydı (işlem türü + zaman + sayısal özet).
 * `detail` yalnızca sayılardan oluşan anahtar=değer çiftleri kabul eder.
 */
export async function recordAudit(
  tx: DbClient,
  action: AuditAction,
  counts: Record<string, number> = {},
): Promise<void> {
  const detail = Object.entries(counts)
    .filter(([k, v]) => /^[a-z_]+$/i.test(k) && Number.isFinite(v))
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  await tx.auditLog.create({ data: { action, detail } });
}
