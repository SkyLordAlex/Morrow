# Changes from the original upload

## Planning defaults in Settings (this pass)

Settings → **Defaults for new plans**: set your usual "time I have each day"
and the weekdays you never study, once, instead of re-entering them every plan.

- New `user_settings` table (1 row per user, cascade-deleted with the account)
  and `GET` / `PUT /settings`. **Run `pnpm --filter @workspace/db run push`
  against the deployed database after pulling this** — the API falls back to
  defaults if the table is missing, so plan creation won't break in the gap.
- `POST /planner/plans` now uses the saved minutes when the request doesn't
  specify one, and unions the saved days-off with anything the note mentions.
- The plan composer's "time each day" field starts from the saved default.

## Settings page with light / dark / system theme (this pass)

New **Settings** page (`/settings`, in the sidebar and the account menu). The
CSS already had a full dark palette (`.dark` in `index.css`) but nothing toggled
it.

- `src/theme/theme-context.tsx`: `ThemeProvider` / `useTheme`. Stores the choice
  in `localStorage` (`morrow.theme`), toggles `.dark` on `<html>`, and follows
  `prefers-color-scheme` live when set to "System".
- Inline script in `index.html` applies the saved theme before first paint — no
  light-mode flash on load.
- Settings page: a three-way Light / System / Dark picker, plus a read-only
  account summary.

## Calendar view (this pass)

A new **Calendar** page (`/calendar`, in the sidebar) shows every study session
laid out on a month grid.

- New API endpoint `GET /planner/sessions` returns all of the signed-in user's
  sessions (`StudySession` now also carries the assignment `accent` for
  colour-coding).
- Month navigation (prev / Today / next); today is marked; each day shows up to
  three colour-coded session chips (dots on phones).
- Tap a day to open a panel listing that day's sessions — check one off, or
  "Move" it to another date, right from the calendar. Both actions refresh the
  dashboard too.

## Respect the dates in the note (this pass)

Due dates the student wrote were being missed and replaced with a "3 days from
now" default.

- **"Math test, Saturday"** — the comma split the day off into its own fragment,
  which was then dropped. Now a trailing date-only fragment ("saturday", "the
  10th", "due friday") re-attaches to the assignment it came from.
- **"due Sept 15" / "the 10th"** — named months and day-of-month numbers weren't
  parsed at all. Now handled (rolling to next year / next month when the date
  would otherwise be in the past).
- **"tomorrow" abbreviations** ("tmrw", "tmr") now recognised.
- Fewer phantom cards from scheduling notes: "I have practice Tuesday and
  Thursday", "no studying on the weekend", "I have work due Friday" (that last
  one is now correctly read as a deadline, not a day off).
- The AI prompt got a firmer, explicit date-resolution spec (today / tomorrow /
  bare weekday / "next week" / named dates).

Eval grew to 146 checks, still 100%.

## Cleaner assignment titles from messy notes (this pass)

The rule-based parser used to name a card with whatever text came before the
due date — "I want to practice math on", "work on the science project". New
`deriveTitle()` in `lib/planner/rules.ts` strips the filler a student wraps
around a task ("I want to", "gotta", "need to", "work on", "study for", a
leading "the/a"), then:

- a real assignment kind → the tidy **"Subject kind"** form ("Math test",
  "English essay", "Science project");
- an activity verb + known subject → **"Subject activity"** ("Math practice",
  "History reading", "Spanish review");
- otherwise the cleaned phrase if it's short and sane, else "Subject work".

Also widened the recognised subject list (science, spanish, french, german,
economics, music). Eval still 114/114.

## Spread work across the available days (this pass)

The scheduler no longer front-loads. For each assignment it builds the window
of usable days (today → due date, minus busy weekdays) and aims for
`ceil(taskCount / windowDays)` tasks per day — so a project due in three weeks
gets ~one short session a day, while one due in two days packs to the budget.
Start times now slot per-day (capped so a crammed day can't run past ~22:00).
The AI prompt also nudges toward more, shorter tasks when a due date is over a
week out. Verified locally (5 tasks → 5 days with runway, → 3 days when tight).

## Schedule around existing sessions (this pass)

`POST /planner/plans` now seeds its per-day minute tally with the sessions the
student *already* has scheduled (status `scheduled`, today onward) before
placing the new ones. So a second plan fills the emptier days instead of
stacking onto ones already at the daily budget. Verified locally: after a plan
fills Thu/Fri, a new plan skips them and lands on the next open days. Summary
text updated ("working around your existing sessions").

## Availability: "I can't study on weekends" (this pass)

The planner now respects days the student says they can't study.

- **AI** (`lib/ai/plan.ts`): the model returns `blockedWeekdays` (0=Sun…6=Sat)
  when the note mentions availability ("no weekends", "busy Tuesdays and
  Thursdays", "only Mon/Wed/Fri" → the other four). New third few-shot example
  shows it.
- **Rule fallback** (`lib/planner/rules.ts`): `detectBlockedWeekdays()` catches
  the common shapes ("can't study \<day\>", "have practice \<day\>", "no school
  \<day\>", "\<only\> \<days\>", weekends). It also now drops availability
  clauses so "i can't study on weekends" doesn't become a phantom assignment.
- **Scheduler** (`routes/planner.ts`): skips blocked weekdays when placing
  sessions; if a due date itself is blocked, backs up to the last allowed day.
  The plan `summary` reflects it ("…and staying off weekends").
- **Shape change**: `generatePlanFromNote` / `rulePlan` now return
  `{ assignments, blockedWeekdays }` (`GeneratedPlan` in `lib/planner/types.ts`).
  Contract to the client is unchanged (no codegen).
- **Eval**: 3 new availability cases in `notes.json`; harness checks
  `blockedWeekdays`. 10/10 cases, 100%.

Verified via curl: sessions never land on a blocked weekday, including when the
due date falls on one; and no phantom assignment from the availability clause.

## "Delete all plans" (this pass)

- **API**: `DELETE /planner/plans` (auth-gated) — deletes all of the signed-in
  user's assignments; ON DELETE CASCADE clears their tasks and sessions.
  Idempotent (204 even with nothing to delete). Account and reviews untouched.
- **Contract**: added to `openapi.yaml`; client regenerated (`useClearPlanner`).
- **Web**: `src/components/clear-planner-button.tsx` — a quiet "Delete all plans"
  link under "Make a plan" on the dashboard, shown only when there's plan data.
  Clicking it opens an `AlertDialog` ("Delete all plans? … This can't be undone"
  / "Keep my plans" / red "Delete everything"); on confirm it clears and
  refetches the dashboard.

Verified: API (401 / 204 / cascade / idempotent) and the confirm dialog in the
browser.

## Tuning the AI + an eval harness (this pass)

Follow-up to the AI integration below — how you "train" it without spending money.

- **Few-shot prompt** (`lib/ai/plan.ts`): the Gemini call now sends a stronger
  system instruction plus **two worked `note → JSON` examples** it imitates for
  task granularity, title style, and date resolution. Costs a few hundred tokens
  per request — free tier absorbs it. All the tunable behaviour is in that one
  file's `SYSTEM_INSTRUCTION` + `FEW_SHOT`.
- **Eval harness**: `pnpm --filter @workspace/api-server run eval:plans` runs
  `src/evals/notes.json` (7 cases) through the planner and checks the assignments
  found, subjects, kinds, due-date windows, and task sanity — a score, not
  exact-match. Scores the AI path when `GEMINI_API_KEY` is set, the rule parser
  otherwise (`EVAL_MODE=rules` to force it). New devdep: `tsx`.
- **Refactor**: the rule parser moved out of `routes/planner.ts` into
  `lib/planner/rules.ts` (db-free, so the eval can import it) with
  `lib/planner/types.ts` for the shared shape.
- **Better fallback parser**: `rules.ts` now understands ISO dates
  (`2026-10-08`), "in N days/weeks", "next <weekday>", "tonight", and common
  subject shorthand (bio, chem, calc, lit…). The eval went from 94% → 100% on
  the rule path.

`docs/AI.md` covers the tune → eval loop.

## Real AI plan generation (this pass)

The "AI" in "AI Study Planner" is now actual AI — optionally. `POST /planner/plans`
sends the student's note to **Google Gemini** (free tier) and turns the reply
into assignments + study tasks; the model does the extraction and task
breakdown, the existing deterministic code still does the scheduling.

- **New**: `artifacts/api-server/src/lib/ai/plan.ts` — Gemini call with a JSON
  response schema, Zod validation, and clamping (durations 10–120 min, due
  dates ≥ today, ≤ 8 assignments × 8 tasks). New deps: `@google/genai`, `zod`.
- **`planner.ts`**: tries AI when `GEMINI_API_KEY` is set, **falls back to the
  rule-based `parseAssignments()` + `taskBlueprint()`** on any failure (no key,
  bad key, network error, rate limit, bad JSON) — plan creation always returns
  201. The route's plan loop now consumes a unified `PlannedAssignment[]` shape
  from either source.
- **Setup** (`docs/AI.md`): free key from aistudio.google.com/app/apikey →
  `GEMINI_API_KEY` in `artifacts/api-server/.env` → restart. Nothing else.
- **Contract unchanged** — `POST /planner/plans` request/response are identical,
  so no codegen. The `summary` string indicates which path ran.

Verified: no-key path produces the same plan as before; a deliberately invalid
key hits Gemini, gets rejected, logs a `warn`, and falls back — still 201. The
successful Gemini path needs a real key to exercise.

## Removed the demo seed data (this pass)

New accounts started with three sample assignments (Biology test / Math
homework / History project) because `ensureSeedData()` in
`artifacts/api-server/src/routes/planner.ts` auto-inserted them on the first
dashboard load. That function is **removed** — new accounts now open an empty
planner (the dashboard's existing empty states cover it). The local Postgres
had its `study_assignments` / `study_tasks` / `study_sessions` tables truncated
too, so existing accounts are also clean; accounts and reviews were untouched.

## Admin roles (this pass)

Accounts now have a **role** (`user` / `admin`). Admins get an **Admin** page in
the web app with app-wide stats, a user list, and review moderation.

- **Schema**: `role` column on `users` (default `"user"`). Run
  `pnpm --filter @workspace/db run push`.
- **Becoming an admin**: put the email in the new **`ADMIN_EMAILS`** env var
  (comma-separated) — it's granted on next sign-in. An existing admin can also
  promote/demote from the Admin page. `ADMIN_EMAILS` only ever *grants* (never
  strips a role on a typo). The local `.env` is set to `aji30@mlschools.org` —
  change it to whatever you want.
- **API** (`artifacts/api-server/src/routes/admin.ts`, gated by
  `requireAuth` + new `requireAdmin`): `GET /admin/stats`, `GET /admin/users`,
  `PATCH /admin/users/{id}/role` (can't change your own),
  `DELETE /admin/users/{id}` (delete any account — can't delete your own here;
  cascade wipes the user's identities, sessions, reviews, and planner rows),
  plus `DELETE /reviews/{id}` in the reviews router for moderation.
- **Contract**: `User.role` added; `AdminStats` / `AdminUser` / `SetRoleInput`
  schemas; client + zod regenerated.
- **Web**: `src/pages/admin.tsx`, `/admin` route, an **Admin** sidebar item
  shown only to admins (non-admins who navigate there get an "Admins only"
  screen), a **Remove** action on every review for admins on the Reviews page,
  and per-user role toggle + delete (two-click confirm) in the Accounts list.

**Bug fixed along the way:** the `admin` and `reviews` routers used a
router-level `router.use(requireAuth/requireAdmin)`. Because they're mounted at
`/` (before the planner router), that gate leaked onto *every* later route —
`requireAdmin` was briefly 403-ing all non-admin planner/review access. Gates
are now per-route (matching `auth.ts`); only the last-mounted `planner` router
still uses `router.use`.

Verified end-to-end: non-admin planner/review access and seeding still work;
role gating (403), self-role-change and self-delete blocked (400),
promote/demote, account deletion + cascade, review moderation — API and the
full Admin page in the browser.

## In-app reviews (this pass)

A **Reviews** page in the web app (`/reviews`, in the sidebar) where signed-in
users leave a 1–5 star rating + optional text — one review each, editable and
deletable. Shows the running average and everyone's reviews.

- **Schema**: `lib/db/src/schema/reviews.ts` — `reviews` table, unique on
  `user_id` (so a second submit updates the row). Run
  `pnpm --filter @workspace/db run push`.
- **API** (`artifacts/api-server/src/routes/reviews.ts`, auth-gated):
  `GET /reviews` (list + average + your review), `PUT /reviews/me` (upsert),
  `DELETE /reviews/me`.
- **Contract**: `Review` / `ReviewSummary` / `ReviewInput` added to
  `openapi.yaml`; client + zod regenerated.
- **Web**: `src/pages/reviews.tsx`, route in `App.tsx`, "Reviews" nav item.
  The dashboard's sidebar + top bar were extracted into
  `src/components/app-shell.tsx` so both pages share the chrome.
- **`artifacts/mockup-sandbox/vite.config.ts`**: same PORT/BASE_PATH default
  fallback applied to study-planner earlier, so `pnpm run build` works locally.

Verified end-to-end: post / update (id stays stable) / delete, per-viewer
`mine` flag, average recompute, rating-range validation. `pnpm run build` green.

## User accounts + per-user data (this pass)

Adds accounts and scopes every planner row to a user — the "Still open" #1 and
#3 below. Full writeup: `docs/AUTH.md`.

**What's new**

- **Schema** (`lib/db/src/schema/`): new `auth.ts` — `users`, `user_identities`,
  `sessions`. `user_id` FK (ON DELETE CASCADE) added to `study_assignments`,
  `study_tasks`, `study_sessions`. Run `pnpm --filter @workspace/db run push`.
- **API**: `POST /auth/register|login|apple|google`, `GET /auth/session`,
  `POST /auth/logout`, `DELETE /auth/account`. All `/planner/*` routes now
  require `Authorization: Bearer <token>` and only see the caller's rows; seed
  data is generated per user on first load.
- **Auth**: opaque bearer sessions stored as SHA-256 hashes in Postgres;
  `crypto.scrypt` password hashing (no native dep); `jose` verifies Apple /
  Google identity tokens against their JWKS. New dep: `jose`.
- **Contract**: `openapi.yaml` gained the `/auth/*` paths; the generated client
  and Zod packages were regenerated (`codegen`).
- **Web** (`artifacts/study-planner`): sign-in screen (email/password + Google +
  Apple when configured), auth gate in `App.tsx`, account menu (sign out /
  delete) in the dashboard top bar, and a vite `/api` dev proxy.
- **iOS** (`artifacts/mobile`): sign-in screen, `Stack.Protected` route guard,
  Account tab with sign out / delete, token in `expo-secure-store`. New deps:
  `expo-secure-store`, `expo-apple-authentication`, `expo-auth-session`,
  `expo-web-browser`, `expo-crypto`.

**Config you still need to provide** — email/password works with none of it:

- `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` on the API server (see
  `artifacts/api-server/.env.example`), and the matching client-side IDs
  (`VITE_*` / `EXPO_PUBLIC_*`). `docs/AUTH.md` has the step-by-step.
- Real `ios.bundleIdentifier` in `artifacts/mobile/app.json`.

**Environment / tooling changes**

- `pnpm-workspace.yaml`: removed the `win32-x64` platform-binary exclusions for
  rollup / esbuild / lightningcss / `@tailwindcss/oxide` so the web app builds
  and runs on Windows. Also added the pnpm-11 `allowBuilds` map (same set as
  `onlyBuiltDependencies`). Neither affects the Linux deploy beyond a slightly
  larger store. Revert the override deletions if you only ever build on Linux.
- `lib/db/drizzle.config.ts`: schema path is now a forward-slashed relative
  string — `path.join(__dirname, …)` produced a Windows backslash path that
  drizzle-kit's globber silently dropped.
- `.gitignore`: ignores `.env` files.

**Verified** against a local Postgres: register/login/apple(unconfigured)/
session/logout/delete, per-user isolation (user B gets 404 touching user A's
session), cascade delete, and the web sign-in → dashboard → delete flow in a
browser. Full `pnpm run typecheck` and `pnpm run build` pass. The iOS app
typechecks; it can't be built or run from this Windows machine (needs EAS or a
Mac).

---

# (earlier pass) Changes from the original upload

Everything else is byte-identical to the zip you sent, including `.git`.

## Applied

**Time zone fix** — dates now resolve in the user's zone, not the server's.
- `artifacts/api-server/src/lib/zoned-time.ts` (new)
- `artifacts/api-server/src/routes/planner.ts` (modified)
- `lib/api-client-react/src/custom-fetch.ts` (modified — sends `X-Time-Zone`)

See `docs/TIMEZONE.md`.

**iOS scaffold** — `artifacts/mobile/`, an Expo app reusing your API and
generated client. Not wired into anything; ignore it while you're web-only.
See `docs/IOS_MIGRATION.md`.

## Not applied

**AI plan generation** — reverted at your request. `planner.ts` uses the
original rule-based `parseAssignments()` / `taskBlueprint()`. No
`@anthropic-ai/sdk` dependency. If you want it back, it's in the conversation.

## Reference only

`docs/morrow-preview.jsx` — standalone React preview of the dashboard with a
time zone selector. Not part of the build; nothing imports it.

## Running it

```bash
pnpm install
pnpm dev
```

Nothing here changes the API contract or the database schema, so no migration
and no client regeneration is needed.

## Still open

1. ~~No `user_id` on any planner table.~~ **Done** — see the top section.
2. ~~The app is named "AI Study Planner" but has no AI.~~ **Done** — Gemini
   plan generation with a rule-based fallback. See the top section + `docs/AI.md`.
3. ~~`POST /planner/plans` has no auth~~ **Done** (auth). Still **no rate limit**
   on plan creation — a signed-in user can spam it.
4. **Subscriptions / paywall** — not built. The accounts layer is now in place
   for it (`docs/AUTH.md` "the model"), and the brief is in `attached_assets/`.
