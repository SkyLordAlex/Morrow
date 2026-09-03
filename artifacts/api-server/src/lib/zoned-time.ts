// Calendar-date helpers that respect the caller's time zone.
//
// The bug these fix: the old code called `startOfDay()` (server-local
// midnight) and then `dateKey()` (`toISOString().slice(0, 10)`, which is UTC).
// Those two disagree whenever the server isn't running in the user's zone.
// Replit runs in UTC, so for a student in New Jersey every session after
// 8pm ET was filed under tomorrow's date, and their "Today" list emptied out
// mid-evening.
//
// The approach here: a day is a `YYYY-MM-DD` string, not a moment. Deciding
// which day it is now needs the user's zone; everything after that is string
// math anchored at UTC midnight, which has no offset to drift.

export const DEFAULT_TIME_ZONE = "UTC";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate an IANA zone name from an untrusted header. Anything unrecognised
 * falls back to UTC rather than throwing — a bad header shouldn't 500 the
 * dashboard.
 */
export function resolveTimeZone(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_TIME_ZONE;
  const candidate = raw.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    // Throws RangeError on an unknown zone.
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** The calendar date at `at`, as seen in `timeZone`. */
export function zonedDateKey(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The hour (0–23) at `at`, as seen in `timeZone`. Used for the greeting. */
export function zonedHour(timeZone: string, at: Date = new Date()): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(at);
  // hourCycle h23 can render midnight as "24" in some locales.
  return Number(value) % 24;
}

// --- Pure calendar math on YYYY-MM-DD strings ------------------------------
// All of these anchor at UTC midnight. No zone is involved, so DST changes
// and offsets can't shift the result.

function toUtcAnchor(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY.test(value);
}

export function addDaysKey(key: string, days: number): string {
  const anchor = toUtcAnchor(key);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/** Day of week, 0 = Sunday. */
export function weekdayOfKey(key: string): number {
  return toUtcAnchor(key).getUTCDay();
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetweenKeys(from: string, to: string): number {
  return Math.round(
    (toUtcAnchor(to).getTime() - toUtcAnchor(from).getTime()) / 86_400_000,
  );
}

/**
 * Format a date key for display. `timeZone: "UTC"` is deliberate and not a
 * bug: the anchor is already UTC midnight, so formatting in any other zone
 * would shift it back off the intended day.
 */
export function formatDateKey(
  key: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return toUtcAnchor(key).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

export function formatDueLabel(dueDate: string, todayKey: string): string {
  const days = daysBetweenKeys(todayKey, dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 0) return "Overdue";
  if (days < 7) return `Due ${formatDateKey(dueDate, { weekday: "long" })}`;
  return `Due ${formatDateKey(dueDate, { month: "short", day: "numeric" })}`;
}

export function greetingFor(timeZone: string, at: Date = new Date()): string {
  const hour = zonedHour(timeZone, at);
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
