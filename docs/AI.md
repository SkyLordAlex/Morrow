# AI plan generation

`POST /planner/plans` turns a student's free-text note into assignments +
study tasks. With a Gemini API key configured it uses a real model; without one
(or if the call fails) it falls back to the built-in keyword parser, so plan
creation never breaks.

## Setup (free)

1. Get a free API key at **https://aistudio.google.com/app/apikey** — a Google
   account, no credit card.
2. Put it in `artifacts/api-server/.env`:
   ```
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-2.5-flash   # optional; any free-tier model works
   ```
3. Restart the API server. That's it — the frontends need no change.

Free-tier limits (Gemini 2.5 Flash) are roughly 15 requests/minute and a few
hundred to ~1,000/day — fine for a small app. Free-tier inputs may be used by
Google to improve their models; revisit before a real launch with student data.

## How it works

| File | Role |
| --- | --- |
| `artifacts/api-server/src/lib/ai/plan.ts` | `generatePlanFromNote(...)` — calls Gemini with a **system instruction + two few-shot examples** and a JSON response schema, validates with Zod, clamps task durations (10–120 min) and due dates (≥ today), caps at 8 assignments × 8 tasks. Throws on any problem. **This is the file you tune.** |
| `artifacts/api-server/src/lib/planner/rules.ts` | `rulePlan()` — the fallback: keyword/regex parser + fixed per-kind `taskBlueprint()`. Understands relative dates ("next Thursday", "in two weeks", ISO dates, "tonight") and common subject shorthand (bio, chem, …). db-free so the eval can run it. |
| `artifacts/api-server/src/routes/planner.ts` | Tries AI when `isAiPlanningConfigured()`, catches any failure, falls back to `rulePlan`, logs a `warn` with the reason. |
| `artifacts/api-server/src/lib/planner/types.ts` | The `PlannedAssignment` shape both paths produce. |

## Tuning it (this is your "training")

The model's behaviour lives entirely in `SYSTEM_INSTRUCTION` and the `FEW_SHOT`
array in `lib/ai/plan.ts`. To make it better at your students' phrasing:

1. Edit the rules text or add another `{ note, plan }` example to `FEW_SHOT`.
   The examples are self-contained (they include their own "Today is …" line and
   the exact JSON you want back) — the model imitates their structure, task
   granularity, and date handling.
2. Run the eval to check you didn't regress:
   ```bash
   pnpm --filter @workspace/api-server run eval:plans
   ```
   With no key it scores the **rule parser**; with `GEMINI_API_KEY` set it scores
   the **AI path** against the same cases. Add cases to
   `src/evals/notes.json` for any phrasing you care about.

Few-shot examples cost a few hundred tokens per request — the free tier absorbs
it. No fine-tuning, no accounts, no spend.

The model does **extraction, task breakdown, and availability** — if the note
says which days the student can or can't study ("no weekends", "busy Tuesdays
and Thursdays", "only Mon/Wed/Fri"), it returns `blockedWeekdays` (0=Sun…6=Sat).
The scheduler in `planner.ts` skips those weekdays when placing sessions (and
backs up off a due date that lands on a blocked day). The plan `summary` says
so ("…and staying off weekends"). The rule fallback catches the common
phrasings; the AI handles nuance.

The scheduling itself — spreading sessions across the days before each due date
under the daily minute budget — is still deterministic code.

The response `summary` string tells you which path ran ("I read your note and
broke it into…" vs "I mapped…").

## Testing

```bash
# structural / semantic eval over src/evals/notes.json
pnpm --filter @workspace/api-server run eval:plans
EVAL_MODE=rules pnpm --filter @workspace/api-server run eval:plans   # force the fallback

# live endpoint — no key → rule-based, still 201
curl -sX POST localhost:5000/api/planner/plans -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H 'x-time-zone: America/New_York' \
  -d '{"note":"biology test friday, math homework tomorrow","availableMinutesPerDay":90}'
```

With a key set, the same curl routes through Gemini; a bad key logs a `warn`
and falls back — plan creation returns 201 either way.

## Cost / model notes

`gemini-2.5-flash` is the sensible default. If you hit rate limits, `GEMINI_MODEL`
can point at `gemini-2.5-flash-lite` (higher limits, slightly weaker) or
`gemini-2.0-flash`. Thinking is disabled in the request (`thinkingBudget: 0`) —
this is structured extraction, not reasoning, so it's faster and cheaper.

This is also the pattern for the "AI flashcards / practice quizzes" in
`attached_assets/` — a new endpoint, same `plan.ts`-style helper, same
key-or-fallback shape.
