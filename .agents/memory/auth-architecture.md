---
name: Auth architecture
description: How accounts and sessions work in this workspace, and the constraints behind the choices.
---

Auth is server-verified with opaque bearer sessions. Accounts live in
`lib/db/src/schema/auth.ts` (`users`, `user_identities`, `sessions`); every
planner table has a `user_id` FK with ON DELETE CASCADE. All `/planner/*` routes
are gated by `requireAuth` (`artifacts/api-server/src/middlewares/`). Full doc:
`docs/AUTH.md`.

**Why these choices:**
- **Bearer token, not cookies, on both web and mobile** — reuses the one
  `setAuthTokenGetter` choke point already in `lib/api-client-react/src/custom-fetch.ts`,
  and avoids CORS-credentials / CSRF surface. Web stores it in `localStorage`,
  iOS in `expo-secure-store`.
- **Sessions are DB rows (SHA-256 of the token), not JWTs** — logout and
  account deletion must actually invalidate, and subscription entitlement needs
  a server-side check keyed on `req.userId`.
- **`crypto.scrypt` for passwords** — Node core, no bcrypt/argon2 native build
  (matches the supply-chain-conscious `.npmrc`).
- **`jose` for Apple/Google** — pure ESM JWKS verification, checks `iss`/`aud`
  from `APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS` (comma-separated env).
- **Accounts link by verified email** so Apple + Google for one address = one
  user.
- **Google on mobile = Expo AuthSession**, not the native SDK, so it runs in
  Expo Go without a dev build. Apple's native button needs a dev/prod build.

Accounts have `role` (`user`/`admin`). `ADMIN_EMAILS` env grants admin on
sign-in (grant-only); `requireAdmin` middleware gates `/admin/*` and
`DELETE /reviews/:id`.

**How to apply:** new authed routes go under the planner router or add
`requireAuth` explicitly; read the user via `currentUserId(req)`; add
`requireAdmin` after `requireAuth` for admin-only routes. Never trust a
client-supplied user id. After changing `openapi.yaml` run `codegen`. See also
[[openapi-zod-compatibility]].
