// Dates are grouped by Europe/London calendar weeks, Monday to Sunday.
// All date strings are YYYY-MM-DD. Noon UTC avoids DST/midnight ambiguity.
export function londonDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return find("year") + "-" + find("month") + "-" + find("day");
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function mondayOf(date: string): string {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}
export function currentWeekStart(now: Date = new Date()): string {
  return mondayOf(londonDate(now));
}
// Sunday: the week finishing today. Mon-Sat: the week finished last Sunday.
export function dueWeekStart(localDay: string): string {
  const monday = mondayOf(localDay);
  const day = new Date(localDay + "T12:00:00Z").getUTCDay();
  return day === 0 ? monday : shiftDate(monday, -7);
}
export function validWeekStart(value: unknown, now: Date = new Date()): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return false;
  if (parsed.getUTCDay() !== 1) return false;
  const current = currentWeekStart(now);
  return value <= current && value >= shiftDate(current, -364);
}
