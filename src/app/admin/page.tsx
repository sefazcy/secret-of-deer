import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { BUDGET_TIERS, INTERESTS } from "@/lib/constants";
import { formatDayLong, formatTime } from "@/lib/format";
import { requireStaff } from "@/features/admin/dal";
import { getAdminDashboard, type AdminDashboard } from "@/features/admin/queries";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { AddJokerButton, RemoveJokerButton } from "@/features/admin/components/joker-controls";
import { MatchingControls } from "@/features/admin/components/matching-controls";
import { PurgeControls } from "@/features/admin/components/purge-controls";

export const metadata: Metadata = { title: "Yönetim Paneli", robots: { index: false } };

const PHASE_LABELS: Record<AdminDashboard["phase"], string> = {
  REGISTRATION: "Faz 1 · Kayıt açık",
  MATCHED: "Faz 2 · Eşleşmeler açıklandı",
  EVENT_DAY: "Faz 3 · Etkinlik günü (bilet modu)",
  CLOSED: "Etkinlik sona erdi",
};

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function Kpi({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {children}
    </Card>
  );
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
    </div>
  );
}

async function AdminContent() {
  const role = await requireStaff("admin");
  const d = await getAdminDashboard();
  const isRegistration = d.phase === "REGISTRATION";
  const blocking = d.tiers.some((t) => t.total === 1);
  const giftPct = percent(d.giftReady.count, d.giftReady.total);
  const checkPct = percent(d.checkedIn.count, d.checkedIn.total);

  return (
    <div className="space-y-6">
      <AdminNav role={role} current="admin" />

      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Yönetim paneli</h1>
        <span className="rounded-full bg-night px-3 py-1 text-sm font-semibold text-snow">{PHASE_LABELS[d.phase]}</span>
      </header>

      {d.phase === "CLOSED" ? (
        <Card>
          <p className="font-semibold">🔥 Tüm kişisel veriler imha edildi.</p>
          {d.dataPurgedAt && (
            <p className="mt-1 text-sm text-ink-muted">
              {formatDayLong(d.dataPurgedAt)} · {formatTime(d.dataPurgedAt)}
            </p>
          )}
        </Card>
      ) : (
        <>
          <section aria-label="Göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Doğrulanmış öğrenci"
              value={String(d.verifiedStudents)}
              hint={d.pendingVerifications ? `${d.pendingVerifications} kişi kodu doğrulamadı` : undefined}
            />
            <Kpi label="Profil oluşturan" value={String(d.profiles)}>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                {d.tiers.map((t) => (
                  <li key={t.tier} className="flex justify-between">
                    <span>{BUDGET_TIERS[t.tier].label}</span>
                    <span className="tabular-nums">{t.students}</span>
                  </li>
                ))}
              </ul>
            </Kpi>
            <Kpi label="“Hediyemi aldım”" value={`%${giftPct}`} hint={`${d.giftReady.count} / ${d.giftReady.total}`}>
              <Bar pct={giftPct} label="Hediye hazır oranı" />
            </Kpi>
            <Kpi label="Check-in" value={`%${checkPct}`} hint={`${d.checkedIn.count} / ${d.checkedIn.total}`}>
              <Bar pct={checkPct} label="Check-in oranı" />
            </Kpi>
          </section>

          <section aria-labelledby="groups-title">
            <Card>
              <h2 id="groups-title" className="font-semibold">
                Bütçe grupları
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Tek sayılı gruplarda bir gönüllü joker eklemek önerilir; joker, gruptaki en yaygın ilgi alanlarını alır.
              </p>
              <ul className="mt-3 divide-y divide-border">
                {d.tiers.map((t) => (
                  <li key={t.tier} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold">{BUDGET_TIERS[t.tier].label}</p>
                      <p className="text-sm text-ink-muted">
                        {t.students} öğrenci{t.jokers ? ` + ${t.jokers} joker` : ""} = {t.total} kişi
                      </p>
                      {t.total === 1 ? (
                        <p className="mt-1 text-sm font-semibold text-holly">⛔ Tek kişi: eşleştirme yapılamaz</p>
                      ) : t.isOdd ? (
                        <p className="mt-1 text-sm font-semibold text-gold">⚠️ Tek sayı ({t.total})</p>
                      ) : t.total > 0 ? (
                        <p className="mt-1 text-sm font-semibold text-pine">✓ Çift sayı</p>
                      ) : null}
                    </div>
                    {isRegistration && <AddJokerButton tier={t.tier} label={BUDGET_TIERS[t.tier].label} />}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section aria-labelledby="engine-title">
            <Card>
              <h2 id="engine-title" className="font-semibold">
                Eşleştirme motoru
              </h2>
              {d.matchesFinalizedAt && (
                <p className="mt-1 text-sm text-ink-muted">
                  {d.matches} eşleşme · {formatDayLong(d.matchesFinalizedAt)} {formatTime(d.matchesFinalizedAt)}
                </p>
              )}
              <div className="mt-3">
                {/* Grup sayıları değişince (joker ekle/kaldır) eski simülasyon özeti sıfırlanır. */}
                <MatchingControls
                  key={d.tiers.map((t) => t.total).join("-")}
                  phase={d.phase}
                  hasBlockingIssue={blocking}
                />
              </div>
            </Card>
          </section>

          {d.jokers.length > 0 && (
            <section aria-labelledby="jokers-title">
              <Card>
                <h2 id="jokers-title" className="font-semibold">
                  🃏 Jokerler
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Jokerler ekip üyesidir; hediye alacakları kişi yalnızca onlar için burada gösterilir.
                </p>
                <ul className="mt-3 space-y-3">
                  {d.jokers.map((j) => (
                    <li key={j.id} className="rounded-xl bg-surface-muted p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">
                          {j.alias} <span className="text-sm font-normal text-ink-muted">· {BUDGET_TIERS[j.tier].label}</span>
                        </p>
                        {isRegistration && <RemoveJokerButton id={j.id} alias={j.alias} />}
                      </div>
                      <p className="mt-1 font-mono text-sm">Bilet: {j.ticketCode}</p>
                      {j.receiver && (
                        <div className="mt-2 text-sm">
                          <p>
                            🎁 Alıcı: <strong>{j.receiver.alias}</strong>
                          </p>
                          <p className="text-ink-muted">
                            {INTERESTS.filter((i) => j.receiver!.interests.includes(i.slug))
                              .map((i) => i.label)
                              .join(", ")}
                          </p>
                          {j.receiver.giftHints && <p className="mt-1">💡 {j.receiver.giftHints}</p>}
                          {j.receiver.giftExclusions && <p className="mt-1 text-holly">⚠️ {j.receiver.giftExclusions}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          <section aria-labelledby="danger-title">
            <Card className="border-holly/40">
              <h2 id="danger-title" className="font-semibold text-holly">
                Tehlikeli bölge
              </h2>
              <p className="mt-1 text-sm text-ink-muted">Etkinlik bittikten sonra KVKK gereği tüm kişisel veriler silinmelidir.</p>
              <div className="mt-3">
                <PurgeControls />
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-2xl bg-border" />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
