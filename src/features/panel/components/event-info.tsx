import { Card } from "@/components/ui/card";
import { EVENT_SUMMARY } from "@/lib/constants";
import { formatDayLong } from "@/lib/format";

export function EventInfo({ eventStartsAt, location }: { eventStartsAt: string; location: string }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location} Hacettepe Üniversitesi`)}`;
  return (
    <Card>
      <h2 className="font-semibold">📍 Buluşma bilgisi</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Tarih</dt>
        <dd className="font-semibold">{formatDayLong(eventStartsAt)}</dd>
        <dt className="text-ink-muted">Saat</dt>
        <dd className="font-semibold">{EVENT_SUMMARY.hours}</dd>
        <dt className="text-ink-muted">Yer</dt>
        <dd className="font-semibold">
          {location}{" "}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-normal text-ink-muted underline underline-offset-4">
            Haritada aç
          </a>
        </dd>
      </dl>
    </Card>
  );
}
