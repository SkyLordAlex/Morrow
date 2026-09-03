# Accounts & authentication

Every planner row is now owned by a user, and the API rejects unauthenticated
requests to `/planner/*`. This doc covers how auth works, what to configure, and
how to test it.

## The model

Server-verified, bearer-token auth.

```
 client                          API server                    Postgres
 ──────                          ──────────                    ────────
 email + password ─────────────► POST /auth/register|login
 Apple identityToken  ─────────► POST /auth/apple  ── verify JWT vs
 Google idToken       ─────────► POST /auth/google     appleid.apple.com /
                                                       accounts.google.com
                                       │
                                       ├─ find/create user ──────► users
                                       │                           user_identities
                                       └─ issue opaque token ────► sessions (sha-256 hash)
                                       ▼
 { token, user }  ◄───────────────────┘
 store token          Authorization: Bearer <token>
   web:  localStorage      every request ──► requireAuth ──► req.userId
   iOS:  expo-secure-store                   (SHA-256 lookup in sessions)
```

- **Passwords**: `crypto.scrypt` (Node core — no bcrypt/argon2 native build),
  stored as `saltHex:keyHex` in `users.password_hash`. Social-only accounts have
  a null hash.
- **Sessions**: 32 random bytes, base64url. Only the SHA-256 hash is stored
  (`sessions.token_hash`). Default TTL 30 days (`SESSION_TTL_DAYS`). Resolving a
  token bumps `last_used_at`; an expired row is deleted on next use.
- **Apple / Google**: the client does the native sign-in and gets a signed JWT.
  The server verifies it with `jose` against the provider's JWKS, checking
  `iss` and `aud`. `sub` + verified `email` become a `user_identities` row.
  Accounts are linked by email, so signing in with Google then Apple (same
  address) lands on one account.
- **Entitlement** (subscriptions, later) is meant to be checked server-side off
  `req.userId` and returned from the API — never read from the device. The
  accounts layer is the prerequisite that made that possible.

### Files

| Area | Path |
| --- | --- |
| Schema | `lib/db/src/schema/auth.ts` (`users`, `user_identities`, `sessions`); `user_id` FKs added in `schema/planner.ts` |
| Password hashing | `artifacts/api-server/src/lib/auth/password.ts` |
| Session tokens | `artifacts/api-server/src/lib/auth/tokens.ts` |
| Apple/Google verification | `artifacts/api-server/src/lib/auth/providers.ts` |
| User lookup/create/link | `artifacts/api-server/src/lib/auth/users.ts` |
| Auth gate | `artifacts/api-server/src/middlewares/require-auth.ts` |
| Routes | `artifacts/api-server/src/routes/auth.ts` |
| Contract | `lib/api-spec/openapi.yaml` → regenerated `@workspace/api-zod`, `@workspace/api-client-react` |
| Web client | `artifacts/study-planner/src/auth/`, `src/pages/sign-in.tsx`, `src/components/account-menu.tsx` |
| iOS client | `artifacts/mobile/src/auth/`, `app/sign-in.tsx`, `app/(tabs)/account.tsx` |

## Endpoints

| Method | Path | Auth | Body → Result |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | `{email,password,displayName?}` → `201 {token,user}` |
| POST | `/api/auth/login` | — | `{email,password}` → `{token,user}` |
| POST | `/api/auth/apple` | — | `{identityToken}` → `{token,user}` |
| POST | `/api/auth/google` | — | `{idToken}` → `{token,user}` |
| GET | `/api/auth/session` | bearer | → `user` (includes `role`) |
| POST | `/api/auth/logout` | bearer | → `204` (revokes current token) |
| DELETE | `/api/auth/account` | bearer | → `204` (deletes user; cascade wipes identities, sessions, planner rows) |

### Roles

Every account has `role: "user" | "admin"`. `ADMIN_EMAILS` grants admin on
sign-in; an admin can also promote/demote via `PATCH /admin/users/{id}/role`.
`requireAdmin` (`middlewares/require-auth.ts`) gates `/admin/*` and
`DELETE /reviews/{id}` — a signed-in non-admin gets `403`. Admin endpoints:
`GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/{id}/role`,
`DELETE /admin/users/{id}` (delete any account; can't target your own — use
`DELETE /auth/account` for that). Gates are applied **per route**, not with
`router.use`, because these routers are mounted at `/`.

In-app account deletion is an App Store requirement (Guideline 5.1.1(v)); it's
the "Delete account" item in the web avatar menu and the iOS Account tab.

## Server configuration

Set these in the API server's environment (`artifacts/api-server/.env` locally,
platform secrets in production). See `.env.example`.

| Var | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | everything | Postgres connection string |
| `PORT` | everything | 5000 for local dev |
| `SESSION_TTL_DAYS` | optional | default 30 |
| `APPLE_CLIENT_IDS` | Apple sign-in | comma-separated allowed `aud` values |
| `GOOGLE_CLIENT_IDS` | Google sign-in | comma-separated allowed `aud` values |
| `ADMIN_EMAILS` | admin console | comma-separated emails auto-granted `role: admin` on sign-in (grant only — never strips) |

Email/password works with zero extra config. Apple/Google buttons stay hidden
(web) or dormant (iOS) until their client IDs are set on both ends.

### Getting the Apple client ID

1. Apple Developer portal → Identifiers → your **App ID**, enable the
   "Sign in with Apple" capability.
2. `APPLE_CLIENT_IDS` = your iOS **bundle identifier** (e.g. `com.yourco.morrow`).
3. For Apple sign-in *on the web* you also need a **Services ID** (a second
   identifier) plus a verified domain and return URL; add that Services ID to
   `APPLE_CLIENT_IDS` too and set `VITE_APPLE_CLIENT_ID` in the web app.
4. `app.json` already has `ios.usesAppleSignIn: true` and the
   `expo-apple-authentication` plugin. Set the real `ios.bundleIdentifier`
   (currently `com.CHANGE-ME.morrow`).

### Getting the Google client IDs

Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID:

- **Web application** client → its ID goes in `GOOGLE_CLIENT_IDS`,
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (mobile), and `VITE_GOOGLE_CLIENT_ID` (web).
  The Expo AuthSession flow used in Expo Go authenticates against this one.
- **iOS** client (bundle ID must match `app.json`) → add to `GOOGLE_CLIENT_IDS`
  and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; used by native/dev builds.

`GOOGLE_CLIENT_IDS` must list every client ID a client might present.

## Testing

### API only

```bash
# .env has DATABASE_URL + PORT; tables created via `pnpm --filter @workspace/db run push`
pnpm --filter @workspace/api-server run dev

curl -s localhost:5000/api/planner/dashboard                       # 401
TOKEN=$(curl -s localhost:5000/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"a@test.dev","password":"hunter2xx","displayName":"A"}' | jq -r .token)
curl -s localhost:5000/api/planner/dashboard -H "authorization: Bearer $TOKEN" | jq .greeting
# register a second user → its dashboard is its own (empty); it gets 404 trying
# to complete the first user's session id
curl -s -X DELETE localhost:5000/api/auth/account -H "authorization: Bearer $TOKEN"   # 204
```

### Web

`artifacts/study-planner/.env` needs `PORT`, `BASE_PATH=/`, and
`VITE_API_PROXY_TARGET=http://localhost:5000` (the vite dev server proxies
`/api` there). Run the API server, then `pnpm --filter @workspace/study-planner
run dev`, open the app: you get the sign-in screen, register or sign in with
email/password, and land on your own dashboard. The avatar menu (top-right) has
Sign out and Delete account.

### iOS (Expo Go)

`artifacts/mobile/.env` needs `EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-ip>:5000`
(not `localhost` — that's the phone). `pnpm --filter @workspace/mobile run dev`,
scan the QR with Expo Go:

- **Email/password** works immediately.
- **Google** works once `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set (opens the
  system browser).
- **Apple**'s native button only renders in a **dev/production build**
  (`eas build --profile development`), not Expo Go — `isAvailableAsync()`
  returns false there, so the button is hidden.

The route guard (`Stack.Protected` in `app/_layout.tsx`) sends you to
`/sign-in` whenever there's no valid session, and to the tabs when there is.

## App Store Connect additions

On top of the checklist in `docs/IOS_MIGRATION.md`:

- Enable **Sign in with Apple** capability on the App ID.
- If you offer Apple *and* another provider (Google), Guideline 4.8 already
  required Apple — which is why all three are here.
- App Privacy questionnaire: you now collect email address and a user ID,
  linked to the user, used for app functionality.
- Confirm in-app account deletion works before submitting (Account tab →
  Delete account) — reviewers test this.
