// The shape the plan builder in routes/planner.ts consumes, produced by either
// the AI path (lib/ai/plan.ts) or the rule-based fallback (lib/planner/rules.ts).

export interface PlannedTask {
  title: string;
  durationMinutes: number;
}

export interface PlannedAssignment {
  title: string;
  subject: string;
  /** YYYY-MM-DD, always today or later. */
  dueDate: string;
  kind: string;
  tasks: PlannedTask[];
}

export interface GeneratedPlan {
  assignments: PlannedAssignment[];
  /**
   * Weekdays the student said they can't study, as 0=Sunday … 6=Saturday.
   * The scheduler skips these when placing sessions. Empty when the note
   * didn't mention availability.
   */
  blockedWeekdays: number[];
}

/** Unique, in-range (0–6) weekday list; all-seven collapses to none. */
export function sanitizeBlockedWeekdays(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const days = [
    ...new Set(
      input
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    ),
  ].sort((a, b) => a - b);
  return days.length >= 7 ? [] : days;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "weekends" / "Tuesdays and Thursdays" — for the plan summary. */
export function describeBlockedWeekdays(days: number[]): string {
  if (days.length === 0) return "";
  const set = new Set(days);
  if (set.size === 2 && set.has(0) && set.has(6)) return "weekends";
  const names = days.map((day) => `${WEEKDAY_NAMES[day]}s`);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
