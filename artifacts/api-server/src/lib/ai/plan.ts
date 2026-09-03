import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { addDaysKey, isDateKey } from "../zoned-time.js";
import {
  sanitizeBlockedWeekdays,
  type GeneratedPlan,
  type PlannedAssignment,
} from "../planner/types.js";

// Turns a student's free-text note into a structured study plan using Google's
// Gemini API (free tier). Anything that goes wrong here — no API key, a network
// error, a rate limit, malformed JSON — throws, and the caller falls back to
// the rule-based `parseAssignments()` so plan creation never breaks.

const KINDS = [
  "test",
  "exam",
  "quiz",
  "homework",
  "project",
  "presentation",
  "paper",
  "essay",
  "assignment",
] as const;

const MIN_TASK_MINUTES = 10;
const MAX_TASK_MINUTES = 120;
const MAX_ASSIGNMENTS = 8;
const MAX_TASKS = 8;
const REQUEST_TIMEOUT_MS = 15_000;

export function isAiPlanningConfigured(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]);
}

const taskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  durationMinutes: z.coerce.number(),
});

const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(140),
  subject: z.string().trim().min(1).max(60),
  kind: z.string().trim().toLowerCase().default("assignment"),
  dueDate: z.string().trim(),
  tasks: z.array(taskSchema).min(1),
});

const planSchema = z.object({
  assignments: z.array(assignmentSchema).min(1),
  blockedWeekdays: z.array(z.coerce.number()).optional(),
});

// OpenAPI-style schema Gemini uses to constrain its JSON output.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subject: { type: Type.STRING },
          kind: { type: Type.STRING, enum: [...KINDS] },
          dueDate: { type: Type.STRING, description: "Due date as YYYY-MM-DD" },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
              },
              required: ["title", "durationMinutes"],
            },
          },
        },
        required: ["title", "subject", "kind", "dueDate", "tasks"],
      },
    },
    blockedWeekdays: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description:
        "Weekday numbers (0=Sunday..6=Saturday) the student cannot study on. Empty if not mentioned.",
    },
  },
  required: ["assignments"],
};

// --- Prompt --------------------------------------------------------------
// The behaviour of the AI planner lives here. Tune these strings and the
// few-shot examples below; run `pnpm --filter @workspace/api-server run
// eval:plans` after any change to check it didn't regress.

const SYSTEM_INSTRUCTION = [
  "You turn a student's messy note about their schoolwork into a focused study plan.",
  "",
  "Rules:",
  "- Return only assignments the student actually mentioned. Never invent extras.",
  "- title: short and specific, naming the assignment itself — \"Chemistry unit 3 test\",",
  "  not \"Study for chemistry\". No leading \"Study for\" / \"Work on\".",
  "- subject: the school subject in Title Case (Chemistry, English, US History).",
  "- kind: one of test, exam, quiz, homework, project, presentation, paper, essay, assignment.",
  "- dueDate: YYYY-MM-DD, worked out from the Today date given at the top of the",
  "  message. Follow the student's wording exactly:",
  "    - \"today\" / \"tonight\" = the Today date. \"tomorrow\" = Today + 1 day.",
  "    - a bare weekday (\"Saturday\", \"by Friday\", \"due monday\") = the NEXT time that",
  "      weekday comes around after Today. \"next <weekday>\" = the one after that.",
  "    - \"next week\" = 7 days out. \"in N days\" / \"in N weeks\" = exactly that far.",
  "    - a named date (\"Sept 15\", \"the 10th\", \"3/14\") = that calendar date; use next",
  "      year only if it would otherwise be in the past.",
  "  Never output a date before Today. Only fall back to a guess (within 7 days) when",
  "  the note gives no timing at all.",
  "- tasks: each ONE focused sitting of 15–60 minutes, in the order they should be done",
  "  (foundational work first). The task title is shown on its own as the name of a",
  "  study session — keep it SHORT and plain, about 3–6 words, a simple action:",
  "  \"Outline the essay\", \"Make a formula sheet\", \"Practice past questions\". Not a full",
  "  sentence, not \"Work on the essay\", not ALL CAPS.",
  "- How many tasks: 3 to 6 normally. When the due date is more than a week away, lean",
  "  toward the higher end with SHORTER tasks (~15–30 min) so the work spreads calmly",
  "  over the many available days rather than a few heavy sessions. When it's only a day",
  "  or two out, fewer, larger tasks are fine.",
  "- Keep each assignment's total task time modest relative to the student's daily budget.",
  "- blockedWeekdays: if the student says which days they can or cannot study",
  "  (\"no weekends\", \"I'm busy Tuesdays and Thursdays\", \"don't have time on Sunday\",",
  "  \"swamped this weekend\", \"I have practice Mon and Wed\", \"only Monday Wednesday Friday\"),",
  "  list the weekday numbers they CANNOT study — 0=Sunday, 1=Monday, … 6=Saturday.",
  "  \"only Mon/Wed/Fri\" means the other four days are blocked. A day named this way is",
  "  availability, NOT schoolwork — never turn \"don't have time on Sunday\" into an",
  "  assignment or a task. Leave blockedWeekdays [] if the note doesn't mention days off.",
].join("\n");

// Few-shot examples. Each is a self-contained (note -> JSON) pair the model
// imitates for structure, task granularity, date resolution, and availability.
const FEW_SHOT: {
  note: string;
  assignments: unknown[];
  blockedWeekdays: number[];
}[] = [
  {
    note: [
      "Today is 2026-01-05 (Monday). I have about 75 minutes a day.",
      "chem test this friday and i need to read chapters 4-5 for english by wednesday",
    ].join("\n"),
    blockedWeekdays: [],
    assignments: [
      {
        title: "Chemistry test",
        subject: "Chemistry",
        kind: "test",
        dueDate: "2026-01-09",
        tasks: [
          { title: "Re-read the unit and highlight the key ideas", durationMinutes: 30 },
          { title: "Make a one-page formula and concept sheet", durationMinutes: 25 },
          { title: "Work through the practice problem set", durationMinutes: 35 },
          { title: "Do a timed self-quiz and mark the gaps", durationMinutes: 25 },
        ],
      },
      {
        title: "English reading: chapters 4–5",
        subject: "English",
        kind: "homework",
        dueDate: "2026-01-07",
        tasks: [
          { title: "Read chapter 4 and note the key moments", durationMinutes: 30 },
          { title: "Read chapter 5 and note the key moments", durationMinutes: 30 },
          { title: "Write a short summary of both chapters", durationMinutes: 20 },
        ],
      },
    ],
  },
  {
    note: [
      "Today is 2026-03-02 (Monday). I have about 90 minutes a day.",
      "history research paper due in two weeks and a bio quiz next tuesday.",
      "i can't study on weekends and i don't have time on fridays",
    ].join("\n"),
    blockedWeekdays: [0, 5, 6],
    assignments: [
      {
        title: "History research paper",
        subject: "History",
        kind: "paper",
        dueDate: "2026-03-16",
        tasks: [
          { title: "Pick a topic and write the research question", durationMinutes: 25 },
          { title: "Find and skim 4–5 sources", durationMinutes: 45 },
          { title: "Take structured notes from the sources", durationMinutes: 45 },
          { title: "Write a one-page outline with the thesis", durationMinutes: 30 },
          { title: "Draft the body paragraphs", durationMinutes: 50 },
          { title: "Revise for clarity and fix citations", durationMinutes: 30 },
        ],
      },
      {
        title: "Biology quiz",
        subject: "Biology",
        kind: "quiz",
        dueDate: "2026-03-10",
        tasks: [
          { title: "Summarise the topic from notes onto one page", durationMinutes: 25 },
          { title: "Make flashcards for the terms and processes", durationMinutes: 25 },
          { title: "Self-test with the flashcards until fluent", durationMinutes: 20 },
        ],
      },
    ],
  },
];

function buildPrompt(
  note: string,
  todayKey: string,
  availableMinutesPerDay: number,
): string {
  return [
    `Today is ${todayKey}. The student has about ${availableMinutesPerDay} minutes`,
    "to study per day. Here is their note:",
    "",
    note.trim(),
  ].join("\n");
}

let cachedClient: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(MAX_TASK_MINUTES, Math.max(MIN_TASK_MINUTES, Math.round(value)));
}

function normalize(
  assignment: z.infer<typeof assignmentSchema>,
  todayKey: string,
): PlannedAssignment {
  let dueDate = assignment.dueDate.slice(0, 10);
  if (!isDateKey(dueDate) || dueDate < todayKey) {
    dueDate = addDaysKey(todayKey, 3);
  }
  const kind = (KINDS as readonly string[]).includes(assignment.kind)
    ? assignment.kind
    : "assignment";

  return {
    title: assignment.title,
    subject: assignment.subject,
    dueDate,
    kind,
    tasks: assignment.tasks.slice(0, MAX_TASKS).map((task) => ({
      title: task.title,
      durationMinutes: clampMinutes(task.durationMinutes),
    })),
  };
}

export async function generatePlanFromNote(
  note: string,
  todayKey: string,
  availableMinutesPerDay: number,
): Promise<GeneratedPlan> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const contents = [
      ...FEW_SHOT.flatMap((example) => [
        { role: "user" as const, parts: [{ text: example.note }] },
        {
          role: "model" as const,
          parts: [
            {
              text: JSON.stringify({
                assignments: example.assignments,
                blockedWeekdays: example.blockedWeekdays,
              }),
            },
          ],
        },
      ]),
      {
        role: "user" as const,
        parts: [
          { text: buildPrompt(note, todayKey, availableMinutesPerDay) },
        ],
      },
    ];

    const response = await client().models.generateContent({
      model: process.env["GEMINI_MODEL"] || "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema,
        // Structured extraction — no need to spend tokens on reasoning.
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");

    const parsed = planSchema.parse(JSON.parse(text));
    return {
      assignments: parsed.assignments
        .slice(0, MAX_ASSIGNMENTS)
        .map((a) => normalize(a, todayKey)),
      blockedWeekdays: sanitizeBlockedWeekdays(parsed.blockedWeekdays),
    };
  } finally {
    clearTimeout(timer);
  }
}
