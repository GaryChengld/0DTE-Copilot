/** Today's date in ET as "YYYY-MM-DD". */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/** ET UTC offset in minutes at an instant (-240 during EDT, -300 during EST). */
function etOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((wallAsUtc - at.getTime()) / 60_000);
}

/**
 * UTC range [start, end) covering the ET calendar day "YYYY-MM-DD", independent of the server's
 * time zone and correct on DST transition days.
 */
export function etDayRange(date: string): { start: Date; end: Date } {
  const midnight = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const utcMidnight = Date.UTC(y, m - 1, day);
    // Sample the offset at 05:00 UTC — just after ET midnight and before the 02:00 ET DST switch
    return new Date(utcMidnight - etOffsetMinutes(new Date(utcMidnight + 5 * 3_600_000)) * 60_000);
  };
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start: midnight(date), end: midnight(next) };
}

export function isMarketHours(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date());

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (["Sat", "Sun"].includes(weekday)) return false;

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const total = hour * 60 + minute;

  return total >= 9 * 60 + 30 && total < 16 * 60;
}
