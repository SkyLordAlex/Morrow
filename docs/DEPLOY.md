# Deploying Morrow (free)

Stack: **Neon** (Postgres) + **Render** (API web service + static site). All
free tier. Total cost: $0. The one catch — Render's free API sleeps after
~15 min idle, so the first request after a break takes ~50s to wake it.

The iOS app is separate and can't be free (Apple charges $99/yr); see
`docs/IOS_MIGRATION.md`.

---

## 1. Push to GitHub

You have no real remote yet. Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Database — Neon

1. Sign up at **neon.tech**, create a project (any region).
2. Copy the connection string (looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. Create the tables — run this once from your machine:
   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm --filter @workspace/db run push
   ```
   Re-run it any time the schema changes (it only applies the diff).

## 3. Deploy — Render

1. Sign up at **render.com**, connect your GitHub.
2. **New → Blueprint**, pick your repo. Render reads `render.yaml` and proposes
   two services: `morrow-api` and `morrow-web`.
3. It will ask for the `sync: false` env vars. Set at least:
   - **`DATABASE_URL`** (on `morrow-api`) — your Neon string.
   - Optional: `GEMINI_API_KEY` (AI plans — free key at
     aistudio.google.com/app/apikey), `ADMIN_EMAILS`, and the Google/Apple
     client IDs if you're wiring up social login.
4. Apply. First build takes a few minutes. `morrow-web` picks up the API's URL
   automatically via `VITE_API_URL`.

When both are live you'll have:
- `https://morrow-web.onrender.com` — the app
- `https://morrow-api.onrender.com` — the API (health check at `/api/healthz`)

## 4. Before you tell anyone

- **Fill in the legal pages.** `artifacts/study-planner/src/pages/legal.tsx`
  has `[bracketed]` placeholders — your name/company, a support email, your
  jurisdiction. It's a plain-language starting template; have it reviewed.
- If you want a custom domain, add it in Render (free) and point a CNAME at it;
  update `VITE_API_URL` if the API also moves to a subdomain.

## Redeploys

Push to `main` → Render rebuilds automatically. Schema changes also need the
`db push` from step 2 against the Neon database.

## Alternatives

- **Cloudflare Pages** for `morrow-web` instead of Render's static site — faster
  CDN, keep `morrow-api` on Render. Set `VITE_API_URL` manually there.
- **Fly.io** — no sleep, can host Postgres too, but needs a credit card and a
  Dockerfile.
