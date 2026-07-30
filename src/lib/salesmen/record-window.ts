/** Shared 24h mutation window (same as invoice edit) */
export const RECORD_MUTATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 24h window from system creation (not backdated business date) */
export function canMutateWithinWindow(
  createdAt: string,
  now: number = Date.now(),
): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created < RECORD_MUTATE_WINDOW_MS && now >= created;
}

export function getMutateRemainingMs(
  createdAt: string,
  now: number = Date.now(),
): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, created + RECORD_MUTATE_WINDOW_MS - now);
}

/** YYYY-MM-DD for date inputs (local calendar day) */
export function toDateInputValue(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Parse a business date (YYYY-MM-DD or ISO). Rejects future calendar days.
 * Noon local time avoids timezone day-shift issues.
 */
export function parseBusinessReceivedAt(
  value: unknown,
): { iso: string } | { error: string } {
  if (value == null || value === "") {
    return { iso: new Date().toISOString() };
  }
  const raw = String(value).trim();
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    date = new Date(y!, m! - 1, d!, 12, 0, 0, 0);
  } else {
    date = new Date(raw);
  }
  if (Number.isNaN(date.getTime())) {
    return { error: "Invalid payment date" };
  }
  const today = new Date();
  const todayEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );
  if (date.getTime() > todayEnd.getTime()) {
    return { error: "Payment date cannot be in the future" };
  }
  return { iso: date.toISOString() };
}
