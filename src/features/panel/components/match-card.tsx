import { Card } from "@/components/ui/card";
import { BUDGET_TIERS } from "@/lib/constants";
import { Avatar } from "@/features/profile/components/avatar";
import type { PanelData } from "../queries";
import { InterestTags } from "./interest-tags";

type Match = NonNullable<PanelData["match"]>;

export function MatchCard({ match }: { match: Match }) {
  const common = match.commonInterests.length;
  return (
    // Card yerine düz kap: Card'ın p-5'i ile p-0 çakışıyordu; başlık bandı kenara oturmalı.
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="bg-night px-5 pb-5 pt-4 text-snow">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Hediye alacağın kişi</p>
        <div className="mt-3 flex items-center gap-4">
          <Avatar avatarId={match.avatarId} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold">{match.alias}</p>
            <p className="text-white/75">Bütçe: {BUDGET_TIERS[match.budgetTier].label}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <h3 className="font-semibold">
            {common > 0 ? (
              <>
                ✨ {common} ortak ilgi alanınız var
              </>
            ) : (
              "İlgi alanları"
            )}
          </h3>
          <div className="mt-2">
            <InterestTags slugs={match.interests} highlight={match.commonInterests} />
          </div>
        </section>

        <section>
          <h3 className="font-semibold">💡 Hediye ipuçları</h3>
          <p className="mt-1 whitespace-pre-line text-ink-muted">
            {match.giftHints || "İpucu bırakmamış. İlgi alanlarından yola çıkabilirsin!"}
          </p>
        </section>

        {match.giftExclusions && (
          <section className="rounded-xl border-2 border-holly/40 bg-holly/5 p-3" aria-label="İstemedikleri ve alerjiler">
            <h3 className="font-semibold text-holly">⚠️ İstemedikleri / alerjiler</h3>
            <p className="mt-1 whitespace-pre-line">{match.giftExclusions}</p>
          </section>
        )}
      </div>
    </article>
  );
}

export function NoMatchNotice() {
  return (
    <Card>
      <h2 className="font-semibold">Eşleşmeni bulamadık 🤔</h2>
      <p className="mt-1 text-ink-muted">
        Kaydın eşleştirmeden sonra tamamlanmış olabilir. Lütfen organizasyon ekibiyle iletişime geç; seni bir joker
        katılımcıyla eşleştirebiliriz.
      </p>
    </Card>
  );
}
