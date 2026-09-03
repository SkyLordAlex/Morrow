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
  "science",
  "spanish",
  "french",
  "german",
  "economics",
  "music",
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

// Task blueprints per assignment kind. Titles fold in the subject so a session
// reads as tailored ("Review your Biology notes") rather than generic. The AI
// path writes its own titles; this is the fallback.
export function taskBlueprint(
  kind: string,
  subject: string,
): readonly (readonly [string, number])[] {
  const s = subject.trim() || "the work";

  if (kind === "test" || kind === "exam" || kind === "quiz") {
    return [
      [`Review your ${s} notes`, 35],
      [`Make a ${s} study sheet`, 30],
      [`Practice ${s} questions`, 35],
      [`Take a ${s} practice quiz`, 20],
    ] as const;
  }
  if (kind === "project" || kind === "presentation") {
    return [
      [`Plan the ${s} project`, 30],
      [`Research the ${s} project`, 45],
      [`Outline the ${s} project`, 35],
      [`Draft the ${s} project`, 45],
      [`Polish the ${s} project`, 25],
    ] as const;
  }
  if (kind === "paper" || kind === "essay") {
    return [
      [`Pick your ${s} essay topic`, 25],
      [`Gather ${s} essay evidence`, 40],
      [`Outline the ${s} essay`, 25],
      [`Draft the ${s} essay`, 45],
      [`Edit the ${s} essay`, 25],
    ] as const;
  }
  return [
    [`Read the ${s} instructions`, 15],
    [`Start the ${s} work`, 25],
    [`Finish the ${s} work`, 25],
    [`Check and submit the ${s} work`, 15],
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

// "I want to practice math", "gotta study for the bio quiz" — filler the
// student wraps around the actual task.
const TITLE_FILLER =
  /^(?:i(?:'ve| ?have| ?want| ?need| ?gotta| ?got| ?should| ?must| ?am going| ?wanna| ?would like)?\s+(?:to|a|an|got to|going to|gotta)?\s*)+|^(?:need to|want to|have to|got to|going to|gonna|wanna|do my|finish my|work on|study for|prep for|prepare for|revise for|review)\s+/i;

const ACTIVITY_NOUN: Record<string, string> = {
  practice: "practice",
  practise: "practice",
  study: "review",
  studying: "review",
  review: "review",
  reviewing: "review",
  revise: "review",
  revising: "review",
  memorize: "review",
  prep: "review",
  prepare: "review",
  read: "reading",
  reading: "reading",
  write: "writing",
  writing: "writing",
  outline: "writing",
  draft: "writing",
  finish: "work",
  complete: "work",
  do: "work",
};

/** A clean, short assignment title from one messy clause. */
function deriveTitle(
  phrase: string,
  subject: string,
  kind: string,
  kindMatched: boolean,
): string {
  // A real assignment kind ("test", "essay", …) → the tidy "Subject kind" form.
  if (kindMatched && subject) return `${subject} ${kind}`;

  // An activity verb ("practice", "read", …) + a known subject → "Subject verb".
  if (subject) {
    for (const word of phrase.toLowerCase().split(/[^a-z]+/)) {
      const noun = ACTIVITY_NOUN[word];
      if (noun) return `${subject} ${noun}`;
    }
  }

  const cleaned = phrase
    .replace(TITLE_FILLER, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:on|for|by|before|in|at|to|and|with|this|next|my)$/i, "")
    .trim()
    .replace(/[.!?,;]+$/, "")
    .trim();

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (cleaned.length >= 4 && wordCount <= 8 && /[a-z]/i.test(cleaned)) {
    return capitalize(cleaned);
  }
  return subject ? `${subject} work` : "Study session";
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
    const matchedSubject = subjectMatch ? capitalize(subjectMatch) : "";
    const dueDate = parseDueDate(normalized, todayKey);
    const beforeDue = normalized
      .split(
        /\bdue\b|\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i,
      )[0]
      .trim()
      .replace(/[.!?]+$/, "");
    const title = deriveTitle(
      beforeDue,
      matchedSubject,
      kind,
      Boolean(kindMatch),
    );
    // Fall back to the first word of the derived title for the subject label.
    const subject =
      matchedSubject || capitalize(title.split(/\s+/)[0] || "Study");

    return {
      title,
      subject,
      dueDate,
      dueLabel: formatDueLabel(dueDate, todayKey),
      kind,
      taskTitles: taskBlueprint(kind, subject).map(([taskTitle]) => taskTitle),
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
      tasks: taskBlueprint(item.kind, item.subject).map(
        ([title, durationMinutes]) => ({ title, durationMinutes }),
      ),
    })),
    blockedWeekdays: detectBlockedWeekdays(note),
  };
}
