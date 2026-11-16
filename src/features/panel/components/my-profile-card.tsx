import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BUDGET_TIERS } from "@/lib/constants";
import { Avatar } from "@/features/profile/components/avatar";
import type { PanelData } from "../queries";
import { InterestTags } from "./interest-tags";

export function MyProfileCard({ me, editable }: { me: PanelData["me"]; editable: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Profilin</h2>
        {editable && (
          <Link href="/panel/profil" className="min-h-11 content-center text-sm font-semibold underline underline-offset-4">
            Düzenle
          </Link>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar avatarId={me.avatarId} size="md" />
        <div className="min-w-0">
          <p className="truncate font-bold">{me.alias}</p>
          <p className="text-sm text-ink-muted">Bütçe: {BUDGET_TIERS[me.budgetTier].label}</p>
        </div>
      </div>
      <div className="mt-4">
        <InterestTags slugs={me.interests} />
      </div>
      {(me.giftHints || me.giftExclusions) && (
        <dl className="mt-4 space-y-2 text-sm">
          {me.giftHints && (
            <div>
              <dt className="text-ink-muted">İpuçların</dt>
              <dd className="whitespace-pre-line">{me.giftHints}</dd>
            </div>
          )}
          {me.giftExclusions && (
            <div>
              <dt className="text-ink-muted">İstemediklerin</dt>
              <dd className="whitespace-pre-line">{me.giftExclusions}</dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}
