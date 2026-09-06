// One-time helper: turn a Gmail OAuth client into a refresh token for sending
// password-reset email. Run once, paste the output into your env.
//
//   1. Google Cloud Console → APIs & Services
//      - Enable the "Gmail API"
//      - OAuth consent screen: External, add your Gmail address as a Test user,
//        add scope  https://www.googleapis.com/auth/gmail.send
//      - Credentials → Create OAuth client ID → type "Desktop app"
//   2. In artifacts/api-server/.env set:
//        GMAIL_CLIENT_ID=...apps.googleusercontent.com
//        GMAIL_CLIENT_SECRET=...
//   3. From the repo root:
//        pnpm --filter @workspace/api-server run gmail:token
//      A browser opens; sign in with the Gmail account and approve.
//   4. Copy the printed GMAIL_REFRESH_TOKEN into .env (and Render).

import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first (artifacts/api-server/.env).",
  );
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code");
    return;
  }

  try {
    const port = server.address().port;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `http://localhost:${port}`,
        grant_type: "authorization_code",
      }),
    });
    const json = await tokenRes.json();
    if (!json.refresh_token) {
      throw new Error(JSON.stringify(json));
    }
    res
      .writeHead(200, { "content-type": "text/plain" })
      .end("Done — you can close this tab and check the terminal.");
    console.log("\n✅ Add this to your env (Render → morrow-api too):\n");
    console.log(`GMAIL_REFRESH_TOKEN=${json.refresh_token}\n`);
  } catch (error) {
    res.writeHead(500).end(String(error));
    console.error("\n❌ Token exchange failed:\n", error);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 200);
  }
});

server.listen(0, () => {
  const port = server.address().port;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `http://localhost:${port}`,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
  console.log("\nOpening the consent screen. If it doesn't open, visit:\n");
  console.log(authUrl + "\n");
  const open =
    process.platform === "win32"
      ? `start "" "${authUrl}"`
      : process.platform === "darwin"
        ? `open "${authUrl}"`
        : `xdg-open "${authUrl}"`;
  exec(open);
});
