# Morrow — AI Study Planner

Turns a student's messy list of assignments into a day-by-day study plan with
scheduled sessions, a workload view, and progress tracking. Web app + a native
iOS (Expo) app share one API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/study-planner run dev` — web app (needs `PORT`, `BASE_PATH`, `VITE_API_PROXY_TARGET` — see its `.env.example`)
- `pnpm --filter @workspace/mobile run dev` — Expo dev server (needs `EXPO_PUBLIC_API_BASE_URL`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `PORT`. Optional: `SESSION_TTL_DAYS`,
  `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS`, `ADMIN_EMAILS`, `GEMINI_API_KEY`
  (see `artifacts/api-server/.env.example`).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: opaque bearer sessions in Postgres; `jose` for Apple/Google JWT verification; `crypto.scrypt` for passwords
- iOS: Expo SDK 54 / React Native, expo-router

## Where things live

- **DB schema (source of truth):** `lib/db/src/schema/` — `planner.ts`
  (assignments/tasks/sessions, each with a `user_id` FK) and `auth.ts`
  (`users`, `user_identities`, `sessions`).
- **API contract (source of truth):** `lib/api-spec/openapi.yaml`. Everything in
  `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` is
  produced from it by `codegen` — never edit generated files by hand.
- **API routes:** `artifacts/api-server/src/routes/` — `planner.ts` (all
  per-user, gated by `requireAuth`), `auth.ts`, `reviews.ts`, `admin.ts`
  (gated by `requireAdmin`), `health.ts`.
- **Auth building blocks:** `artifacts/api-server/src/lib/auth/` and
  `middlewares/require-auth.ts`. Full writeup: `docs/AUTH.md`.
- **Plan generation:** `lib/ai/plan.ts` (Gemini + few-shot, the tunable file),
  `lib/planner/rules.ts` (rule-based fallback), `lib/planner/types.ts`. Eval:
  `src/evals/` + `pnpm --filter @workspace/api-server run eval:plans`. See
  `docs/AI.md`.
- **Time-zone handling:** `artifacts/api-server/src/lib/zoned-time.ts` +
  `docs/TIMEZONE.md`.
- **Design tokens:** `artifacts/study-planner/src/index.css` (HSL) mirrored to
  hex in `artifacts/mobile/src/theme.ts` — keep them in sync.
- **Client auth:** `artifacts/study-planner/src/auth/`,
  `artifacts/mobile/src/auth/`.

## Architecture decisions

- **Bearer tokens, both platforms.** Web keeps the token in `localStorage`,
  iOS in `expo-secure-store`; both attach it via the `setAuthTokenGetter` hook
  in `lib/api-client-react/src/custom-fetch.ts`. No cookies (avoids CORS-
  credentials and CSRF surface); the token is opaque and revocable.
- **Sessions are DB rows, not JWTs** — so logout and account deletion actually
  invalidate, and entitlement can be checked server-side later.
- **Accounts link by verified email**, so Apple + Google for the same address
  resolve to one user.
- **Google on mobile uses Expo AuthSession** (web OAuth), not the native SDK,
  so it runs in Expo Go without a dev build. Apple's native button needs a
  dev/prod build.
- The planner uses **Google Gemini** (free tier) when `GEMINI_API_KEY` is set,
  and falls back to the rule-based `parseAssignments()` / `taskBlueprint()`
  otherwise or on any model failure. See `docs/AI.md`.

## Product

- Paste a note ("bio lab, quiz Friday, history essay") → the app splits it into
  small tasks and schedules study sessions across the days before each due date,
  capped at a daily minute budget.
- Dashboard: today's focus session, today's session list (complete / reschedule),
  upcoming deadlines, a 7-day workload chart, week totals + streak.
- Accounts: email/password, Sign in with Apple, Google. Each user has their own
  planner data. In-app account deletion.
- Reviews: signed-in users leave one editable 1–5 star review of the app on the
  `/reviews` page; the average and all reviews are visible there.
- AI: paste a free-text note ("bio test Friday, math hw tomorrow") → Gemini
  extracts assignments and study tasks; the scheduler places the sessions.
- Admin role (`ADMIN_EMAILS` or promoted by another admin): `/admin` page with
  app-wide stats, a user list with role toggles, and review moderation.

## User preferences

- Developing on **Windows** (no Mac). iOS builds go through EAS cloud, not local
  Xcode. Native Swift is not an option on this machine.

## Gotchas

- **Run `pnpm --filter @workspace/db run push` after pulling** if the schema
  changed — also runs in `scripts/post-merge.sh`.
- **All `/planner/*` routes require `Authorization: Bearer <token>`.** A 401
  from the client usually means the stored token expired — the auth context
  clears it and drops to the sign-in screen.
- After editing `openapi.yaml`, run `codegen` and commit the regenerated files.
- OpenAPI numeric fields: use `type: number`, not `integer` — see
  `.agents/memory/openapi-zod-compatibility.md`.
- `pnpm-workspace.yaml` no longer excludes the `win32-x64` platform binaries
  (rollup/esbuild/lightningcss/oxide) so the app builds on Windows; harmless to
  the Linux deploy.
- The web app's vite config **requires** `PORT` and `BASE_PATH` env vars at
  config-load time (before `.env` is read) — pass them in the environment.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- `docs/AUTH.md` — auth architecture, provider setup, App Store Connect notes
