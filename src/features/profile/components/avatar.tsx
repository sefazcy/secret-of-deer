import { AVATARS } from "@/lib/constants";

const SIZES = { sm: "size-10 text-xl", md: "size-14 text-3xl", lg: "size-20 text-5xl" } as const;

/**
 * @param decorative Yanında zaten görünür bir etiket varsa (ör. avatar seçici) ekran okuyucudan gizler.
 */
export function Avatar({
  avatarId,
  size = "md",
  decorative = false,
}: {
  avatarId: string;
  size?: keyof typeof SIZES;
  decorative?: boolean;
}) {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": avatar ? `${avatar.label} avatarı` : "Avatar" } as const);
  return (
    <span
      {...a11y}
      className={`grid shrink-0 place-items-center rounded-full bg-night text-snow ring-2 ring-gold/60 ${SIZES[size]}`}
    >
      <span aria-hidden>{avatar?.emoji ?? "❄️"}</span>
    </span>
  );
}
