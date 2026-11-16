const TZ = "Europe/Istanbul";

/** "26 Aralık Cumartesi" */
export function formatDayLong(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: TZ }).format(
    new Date(iso),
  );
}

/** "18.00" */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    .format(new Date(iso))
    .replace(":", ".");
}
