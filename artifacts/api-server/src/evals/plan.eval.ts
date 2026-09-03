/**
 * Eval harness for study-plan generation. Run after changing the prompt or the
 * rule parser to check quality didn't regress:
 *
 *   pnpm --filter @workspace/api-server run eval:plans          # AI if GEMINI_API_KEY set, else rules
 *   EVAL_MODE=rules pnpm --filter @workspace/api-server run eval:plans   # force the rule parser
 *
 * These are structural / semantic checks, not exact-match — LLM output varies,
 * so we assert on: the right assignments were found, subjects and kinds are
 * right, due dates resolve to the expected window, and the task breakdown is
 * sane. Exits non-zero if the score drops below THRESHOLD.
 */
import { readFileSync } from "node:fs";
import {
  generatePlanFromNote,
  isAiPlanningConfigured,
} from "../lib/ai/plan.js";
import { rulePlan } from "../lib/planner/rules.js";
import { daysBetweenKeys, isDateKey } from "../lib/zoned-time.js";
import type { GeneratedPlan } from "../lib/planner/types.js";

const THRESHOLD = 0.8;

interface ExpectedAssignment {
  subject: string;
  kind?: string[];
  dueInDays?: [number, number];
}
interface Case {
  name: string;
  today: string;
  minutesPerDay: number;
  note: string;
  expect: { assignments: ExpectedAssignment[]; blockedWeekdays?: number[] };
}

const cases: Case[] = JSON.parse(
  readFileSync(new URL("./notes.json", import.meta.url), "utf8"),
);

const forceRules = process.env["EVAL_MODE"] === "rules";
const useAi = !forceRules && isAiPlanningConfigured();

async function planFor(c: Case): Promise<GeneratedPlan> {
  if (useAi) {
    return generatePlanFromNote(c.note, c.today, c.minutesPerDay);
  }
  return rulePlan(c.note, c.today);
}

type Check = { ok: boolean; label: string };

function sameSet(a: number[], b: number[]): boolean {
  const bs = new Set(b);
  return a.length === b.length && a.every((n) => bs.has(n));
}

function evaluate(c: Case, generated: GeneratedPlan): Check[] {
  const checks: Check[] = [];
  const push = (ok: boolean, label: string) => checks.push({ ok, label });
  const plan = generated.assignments;

  push(
    Math.abs(plan.length - c.expect.assignments.length) <= 1,
    `assignment count ~${c.expect.assignments.length} (got ${plan.length})`,
  );

  if (c.expect.blockedWeekdays) {
    push(
      sameSet(
        [...generated.blockedWeekdays].sort(),
        [...c.expect.blockedWeekdays].sort(),
      ),
      `blockedWeekdays = [${c.expect.blockedWeekdays.join(", ")}] (got [${generated.blockedWeekdays.join(", ")}])`,
    );
  }

  for (const want of c.expect.assignments) {
    const match = plan.find((a) =>
      a.subject.toLowerCase().includes(want.subject.toLowerCase()),
    );
    push(Boolean(match), `found a "${want.subject}" assignment`);
    if (!match) continue;

    if (want.kind) {
      push(
        want.kind.includes(match.kind),
        `${want.subject} kind in [${want.kind.join(", ")}] (got "${match.kind}")`,
      );
    }
    push(
      isDateKey(match.dueDate) && match.dueDate >= c.today,
      `${want.subject} dueDate is a valid non-past date (got "${match.dueDate}")`,
    );
    if (want.dueInDays && isDateKey(match.dueDate)) {
      const delta = daysBetweenKeys(c.today, match.dueDate);
      const [lo, hi] = want.dueInDays;
      push(
        delta >= lo && delta <= hi,
        `${want.subject} due in ${lo}–${hi} days (got ${delta})`,
      );
    }
  }

  for (const a of plan) {
    push(
      a.tasks.length >= 3 && a.tasks.length <= 8,
      `"${a.title}" has 3–8 tasks (got ${a.tasks.length})`,
    );
    push(
      a.tasks.every((t) => t.durationMinutes >= 10 && t.durationMinutes <= 120),
      `"${a.title}" task durations in 10–120 min`,
    );
    const titles = a.tasks.map((t) => t.title.toLowerCase().trim());
    push(
      new Set(titles).size === titles.length,
      `"${a.title}" has no duplicate task titles`,
    );
  }

  return checks;
}

async function main() {
  console.log(
    `\nStudy-plan eval — mode: ${useAi ? "AI (Gemini)" : "rules"}\n`,
  );

  let passed = 0;
  let total = 0;

  for (const c of cases) {
    let plan: GeneratedPlan;
    try {
      plan = await planFor(c);
    } catch (error) {
      console.log(`✗ ${c.name}`);
      console.log(
        `    generation threw: ${error instanceof Error ? error.message : error}`,
      );
      total += 1;
      continue;
    }

    const checks = evaluate(c, plan);
    const casePassed = checks.filter((ch) => ch.ok).length;
    passed += casePassed;
    total += checks.length;

    const allOk = casePassed === checks.length;
    console.log(`${allOk ? "✓" : "✗"} ${c.name}  (${casePassed}/${checks.length})`);
    for (const ch of checks) {
      if (!ch.ok) console.log(`    ✗ ${ch.label}`);
    }
  }

  const score = total === 0 ? 0 : passed / total;
  console.log(`\nScore: ${passed}/${total} = ${(score * 100).toFixed(0)}%`);
  if (score < THRESHOLD) {
    console.log(`Below threshold (${(THRESHOLD * 100).toFixed(0)}%).`);
    process.exit(1);
  }
}

void main();
