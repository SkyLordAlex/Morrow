import { addDaysKey, formatDueLabel, weekdayOfKey } from "../zoned-time.js";
import { sanitizeBlockedWeekdays, type GeneratedPlan } from "./types.js";

// The rule-based planner: a keyword/regex parser plus fixed per-kind task
// blueprints. Used as the fallback whenever the AI path (lib/ai/plan.ts) is
// unconfigured or fails. Kept db-free so it can be unit-tested and run in the
// eval harness without a database.

export const SUBJECTS = [
  "biology",
  "math",
  "history",
  "english",
  "chemistry",
  "physics",
  "computer science",
  "art",
  "geography",
  "psychology",
];

// Common shorthand → canonical subject.
const SUBJECT_ALIASES: Record<string, string> = {
  bio: "biology",
  chem: "chemistry",
  phys: "physics",
  calc: "math",
  maths: "math",
  algebra: "math",
  geometry: "math",
  lit: "english",
  hist: "history",
  psych: "psychology",
  geo: "geography",
  cs: "computer science",
  comp: "computer science",
};

function matchSubject(text: string): string | undefined {
  const lower = text.toLowerCase();
  const direct = SUBJECTS.find((subject) => lower.includes(subject));
  if (direct) return direct;
  for (const [alias, subject] of Object.entries(SUBJECT_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) return subject;
  }
  return undefined;
}

export type ParsedAssignment = {
  title: string;
  subject: string;
  dueDate: string;
  dueLabel: string;
  kind: string;
  taskTitles: string[];
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

function parseDueDate(clause: string, todayKey: string) {
  const normalized = clause.toLowerCase();

  // Explicit ISO date wins.
  const iso = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // "in 3 days" / "in two weeks".
  const relative = normalized.match(
    /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|week)s?\b/,
  );
  if (relative) {
    const count = /^\d+$/.test(relative[1])
      ? Number(relative[1])
      : (NUMBER_WORDS[relative[1]] ?? 3);
    return addDaysKey(todayKey, relative[2] === "week" ? count * 7 : count);
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const weekdayIndex = weekdays.findIndex((day) => normalized.includes(day));
  if (weekdayIndex >= 0) {
    const currentDay = weekdayOfKey(todayKey);
    let daysAhead = (weekdayIndex - currentDay + 7) % 7;
    if (daysAhead === 0 && !normalized.includes("today")) daysAhead = 7;
    // "next <weekday>" means the one after this coming one.
    if (normalized.includes("next ") && daysAhead <= 6) daysAhead += 7;
    return addDaysKey(todayKey, daysAhead);
  }
  if (normalized.includes("tomorrow")) return addDaysKey(todayKey, 1);
  if (normalized.includes("tonight") || normalized.includes("today")) {
    return todayKey;
  }
  if (
    normalized.includes("next week") ||
    normalized.includes("following week")
  ) {
    const daysUntilMonday = (8 - weekdayOfKey(todayKey)) % 7 || 7;
    return addDaysKey(todayKey, daysUntilMonday);
  }
  return addDaysKey(todayKey, 3);
}

export function taskBlueprint(kind: string) {
  if (kind === "test" || kind === "exam" || kind === "quiz") {
    return [
      ["Review class notes", 35],
      ["Make a one-page study guide", 30],
      ["Practice recall questions", 35],
      ["Do a timed review", 20],
    ] as const;
  }
  if (kind === "project" || kind === "presentation") {
    return [
      ["Choose a direction", 30],
      ["Gather sources and examples", 45],
      ["Build a rough outline", 35],
      ["Draft the main work", 45],
      ["Revise and polish", 25],
    ] as const;
  }
  if (kind === "paper" || kind === "essay") {
    return [
      ["Choose a topic and question", 25],
      ["Gather evidence", 40],
      ["Write an outline", 25],
      ["Draft the argument", 45],
      ["Edit for clarity", 25],
    ] as const;
  }
  return [
    ["Understand the instructions", 15],
    ["Complete the first half", 25],
    ["Finish the work", 25],
    ["Check answers and submit", 15],
  ] as const;
}

const KIND_WORD =
  /\b(test|exam|homework|project|paper|essay|quiz|presentation|assignment|report|lab|reading|worksheet|study guide|flashcards?)\b/i;

// A clause that's about *when the student is free*, not an assignment —
// "i can't study on weekends", "i have practice tuesday and thursday".
// prettier-ignore
const DAY_WORDS = new Set([
  "sun","sunday","sundays","mon","monday","mondays","tue","tues","tuesday","tuesdays",
  "wed","weds","wednesday","wednesdays","thu","thur","thurs","thursday","thursdays",
  "fri","friday","fridays","sat","saturday","saturdays","weekend","weekends",
]);
const DAY_CONNECTORS = new Set(["and", "or", "the", "on", "nor"]);

/** True for "thursday", "tuesday and thursday", "the weekend" — no other words. */
function isDayOnlyClause(clause: string): boolean {
  const tokens = clause.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const dayCount = tokens.filter((t) => DAY_WORDS.has(t)).length;
  return (
    dayCount > 0 &&
    tokens.every((t) => DAY_WORDS.has(t) || DAY_CONNECTORS.has(t))
  );
}

function isAvailabilityClause(clause: string): boolean {
  const c = clause.toLowerCase().trim();
  if (KIND_WORD.test(c)) return false;

  // A clause that is just day names — the tail of a "practice tuesday and
  // thursday" that the "and"-split cut off.
  if (isDayOnlyClause(c)) return true;

  const negatesStudy =
    /\b(can'?t|cannot|can not|won'?t|will not|unable to|not (?:free|available|able)|busy|no time|have (?:practice|work|a shift|games?|rehearsal)|only|just)\b/.test(
      c,
    );
  const namesDayOrStudy =
    /\b(study|studying|weekends?|sun(?:day)?s?|mon(?:day)?s?|tue(?:s(?:day)?)?s?|wed(?:nesday)?s?|thu(?:rs(?:day)?)?s?|fri(?:day)?s?|sat(?:urday)?s?)\b/.test(
      c,
    );
  return negatesStudy && namesDayOrStudy;
}

export function parseAssignments(
  note: string,
  todayKey: string,
): ParsedAssignment[] {
  const clauses = note
    .replace(/^\s*i\s+have\s+/i, "")
    .replace(/,\s+and\s+/gi, ", ")
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((clause) => !isAvailabilityClause(clause));

  return clauses.map((clause, index) => {
    const normalized = clause.replace(/^(a|an|the)\s+/i, "").trim();
    const subjectMatch = matchSubject(normalized);
    const kindMatch = normalized.match(
      /\b(test|exam|homework|project|paper|essay|quiz|presentation|assignment)\b/i,
    );
    const kind = (kindMatch?.[1] ?? "assignment").toLowerCase();
    const subject = subjectMatch
      ? capitalize(subjectMatch)
      : capitalize(normalized.split(/\s+/)[0] ?? `Subject ${index + 1}`);
    const dueDate = parseDueDate(normalized, todayKey);
    const beforeDue = normalized
      .split(
        /\bdue\b|\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i,
      )[0]
      .trim()
      .replace(/[.!?]+$/, "");
    const fallbackTitle = `${subject} ${kind}`;
    const title = beforeDue.length >= 4 ? capitalize(beforeDue) : fallbackTitle;

    return {
      title,
      subject,
      dueDate,
      dueLabel: formatDueLabel(dueDate, todayKey),
      kind,
      taskTitles: taskBlueprint(kind).map(([taskTitle]) => taskTitle),
    };
  });
}

const WEEKDAY_TOKENS: [RegExp, number][] = [
  [/\bsun(day)?s?\b/, 0],
  [/\bmon(day)?s?\b/, 1],
  [/\btue(s(day)?)?s?\b/, 2],
  [/\bwed(nesday)?s?\b/, 3],
  [/\bthu(rs(day)?)?s?\b/, 4],
  [/\bfri(day)?s?\b/, 5],
  [/\bsat(urday)?s?\b/, 6],
];

function weekdaysIn(text: string): number[] {
  const days = WEEKDAY_TOKENS.filter(([re]) => re.test(text)).map(
    ([, day]) => day,
  );
  if (/\bweekends?\b/.test(text)) days.push(0, 6);
  return days;
}

// Words that signal "I'm not studying then". The AI path handles subtle
// phrasing; this catches the common "<can't-word> ... <day>" shape.
const UNAVAILABLE =
  /\b(can'?t|cannot|can not|won'?t|will not|unable to|not (?:able|free|available)|no (?:study|studying|school|class|homework)|busy|have (?:practice|work|a shift|games?|rehearsal)|skip|avoid|off|away)\b/gi;

/** Best-effort blocked-weekday detection from a free-text note. */
export function detectBlockedWeekdays(note: string): number[] {
  const text = note.toLowerCase();

  // "only mondays, wednesdays and fridays" → the other days are blocked.
  const only = text.match(/\b(?:only|just)\b([^.!?\n]*)/);
  if (only) {
    const allowed = weekdaysIn(only[1]);
    if (allowed.length > 0) {
      return sanitizeBlockedWeekdays(
        [0, 1, 2, 3, 4, 5, 6].filter((day) => !allowed.includes(day)),
      );
    }
  }

  // For each unavailability word, read the ~42 chars after it (stopping at a
  // sentence break) and block every weekday named there.
  const blocked = new Set<number>();
  for (const match of text.matchAll(UNAVAILABLE)) {
    const window = text
      .slice(match.index)
      .split(/[.!?;\n]/)[0]
      .slice(0, 42);
    for (const day of weekdaysIn(window)) blocked.add(day);
  }
  return sanitizeBlockedWeekdays([...blocked]);
}

/** The rule-based fallback in the unified plan shape. */
export function rulePlan(note: string, todayKey: string): GeneratedPlan {
  return {
    assignments: parseAssignments(note, todayKey).map((item) => ({
      title: item.title,
      subject: item.subject,
      dueDate: item.dueDate,
      kind: item.kind,
      tasks: taskBlueprint(item.kind).map(([title, durationMinutes]) => ({
        title,
        durationMinutes,
      })),
    })),
    blockedWeekdays: detectBlockedWeekdays(note),
  };
}
