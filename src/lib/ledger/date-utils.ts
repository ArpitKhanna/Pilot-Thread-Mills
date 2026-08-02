/** Start/end of a calendar day in local time as ISO strings for Supabase filters. */
export function dayBounds(dateInput: string): { start: string; end: string; date: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const [y, m, d] = date.split("-").map(Number);
    const start = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
    const end = new Date(y!, m! - 1, d!, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), date };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: dateInput.trim(),
  };
}

export function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function calendarDaysBetween(fromIso: string, toDate: Date = new Date()): number {
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );
}
