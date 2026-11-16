import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/features/event/countdown";
import { getParticipantCount } from "@/features/event/queries";
import { AutoRefresh } from "@/features/panel/components/auto-refresh";
import { EventInfo } from "@/features/panel/components/event-info";
import { GiftReady } from "@/features/panel/components/gift-ready";
import { LogoutButton } from "@/features/panel/components/logout-button";
import { MatchCard, NoMatchNotice } from "@/features/panel/components/match-card";
import { MyProfileCard } from "@/features/panel/components/my-profile-card";
import { TicketCard } from "@/features/panel/components/ticket-card";
import { getPanelData, type PanelData } from "@/features/panel/queries";

export const metadata: Metadata = { title: "Panelim" };

export default function PanelPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-10">
      <Suspense fallback={<PanelSkeleton />}>
        <PanelContent />
      </Suspense>
    </div>
  );
}

async function PanelContent() {
  const data = await getPanelData();
  switch (data.phase) {
    case "REGISTRATION":
      return <WaitingPhase data={data} />;
    case "MATCHED":
      return <MatchedPhase data={data} />;
    case "EVENT_DAY":
      return <EventDayPhase data={data} />;
    case "CLOSED":
      return <ClosedPhase />;
  }
}

// ── Faz 1: Eşleşme öncesi ────────────────────────────────────

async function ParticipantCount() {
  return <>{await getParticipantCount()}</>;
}

function WaitingPhase({ data }: { data: PanelData }) {
  return (
    <div className="space-y-5">
      <AutoRefresh seconds={30} />
      <header>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pine/15 px-3 py-1 text-sm font-semibold text-pine">
          ✅ Kaydın tamamlandı
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Selam, {data.me.alias}!</h1>
        <p className="mt-1 text-ink-muted">Kayıtlar kapanınca eşleşmeler yapılacak ve sana e-posta ile haber vereceğiz.</p>
      </header>

      <section className="rounded-2xl bg-night p-5 text-snow" aria-label="Kayıt durumu">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-white/75">Şu ana kadar katılan</p>
          <p className="text-3xl font-bold tabular-nums">
            <Suspense fallback="…">
              <ParticipantCount />
            </Suspense>
            {" "}
            <span className="text-base font-medium text-white/75">kişi</span>
          </p>
        </div>
        <p className="mb-2 mt-5 text-sm text-white/75">Eşleşmelere kalan süre</p>
        <Countdown target={data.event.registrationClosesAt} />
      </section>

      <MyProfileCard me={data.me} editable />
      <EventInfo eventStartsAt={data.event.eventStartsAt} location={data.event.location} />
      <LogoutButton />
    </div>
  );
}

// ── Faz 2: Eşleşme sonrası ───────────────────────────────────

function MatchedPhase({ data }: { data: PanelData }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">🎄 Eşleşmen hazır!</h1>
        <p className="mt-1 text-ink-muted">Bu bilgiyi kimseyle paylaşma; sürpriz bozulmasın.</p>
      </header>
      {data.match ? <MatchCard match={data.match} /> : <NoMatchNotice />}
      {data.match && <GiftReady isGiftReady={data.me.isGiftReady} />}
      <EventInfo eventStartsAt={data.event.eventStartsAt} location={data.event.location} />
      <LogoutButton />
    </div>
  );
}

// ── Faz 3: Etkinlik günü / bilet modu ────────────────────────

function EventDayPhase({ data }: { data: PanelData }) {
  return (
    <div className="space-y-5">
      {/* Kapıda check-in yapılınca rozet kendiliğinden görünsün. */}
      {!data.me.isCheckedIn && <AutoRefresh seconds={10} />}
      {data.ticket && (
        <TicketCard
          code={data.ticket.code}
          qrPayload={data.ticket.qrPayload}
          alias={data.me.alias}
          isCheckedIn={data.me.isCheckedIn}
        />
      )}
      {data.match && !data.me.isGiftReady && <GiftReady isGiftReady={false} />}
      <EventInfo eventStartsAt={data.event.eventStartsAt} location={data.event.location} />
      {data.match ? (
        <details className="group rounded-2xl border border-border bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 font-semibold">
            🎁 Hediye alacağın kişi: {data.match.alias}
            <span className="text-ink-muted transition group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="px-2 pb-2">
            <MatchCard match={data.match} />
          </div>
        </details>
      ) : (
        <NoMatchNotice />
      )}
      <LogoutButton />
    </div>
  );
}

function ClosedPhase() {
  return (
    <Card className="text-center">
      <p className="text-4xl" aria-hidden>
        🦌
      </p>
      <h1 className="mt-2 text-xl font-bold">Etkinlik sona erdi</h1>
      <p className="mt-1 text-ink-muted">Katıldığın için teşekkürler! Mutlu yıllar 🎄</p>
    </Card>
  );
}

function PanelSkeleton() {
  return (
    <div aria-busy className="animate-pulse space-y-5">
      <div className="h-7 w-40 rounded-full bg-border" />
      <div className="h-8 w-2/3 rounded bg-border" />
      <div className="h-44 rounded-2xl bg-border" />
      <div className="h-40 rounded-2xl bg-border" />
    </div>
  );
}
