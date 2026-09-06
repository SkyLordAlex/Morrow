import { logger } from "./logger.js";

// Transactional email through the Gmail REST API over HTTPS. SMTP is a
// non-starter on hosts that block outbound mail ports (Render's free tier),
// and the API sends from the real Gmail account with its own reputation.
//
// One-time setup produces a refresh token — see docs/AUTH.md or run
// `pnpm --filter @workspace/api-server run gmail:token`. Then set:
//   GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Unset → mail is logged instead of sent so the flow stays testable.

const GMAIL_USER = process.env["GMAIL_USER"];
const CLIENT_ID = process.env["GMAIL_CLIENT_ID"];
const CLIENT_SECRET = process.env["GMAIL_CLIENT_SECRET"];
const REFRESH_TOKEN = process.env["GMAIL_REFRESH_TOKEN"];
const FROM_NAME = process.env["EMAIL_FROM_NAME"] || "Morrow";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export function isEmailConfigured(): boolean {
  return Boolean(GMAIL_USER && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

let accessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt - 60_000 > Date.now()) {
    return accessToken.value;
  }
  const body = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    client_secret: CLIENT_SECRET ?? "",
    refresh_token: REFRESH_TOKEN ?? "",
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Gmail token refresh failed: ${json.error ?? res.status} ${
        json.error_description ?? ""
      }`.trim(),
    );
  }
  accessToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return accessToken.value;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildMime(mail: Mail): string {
  const boundary = `b_${Math.random().toString(36).slice(2)}`;
  const b64 = (s: string) =>
    Buffer.from(s, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

  const parts = [
    `From: "${FROM_NAME}" <${GMAIL_USER}>`,
    `To: ${mail.to}`,
    `Subject: ${mail.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(mail.text),
  ];
  if (mail.html) {
    parts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64(mail.html),
    );
  }
  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send an email. Never throws — a failure is logged and returns false so the
 * caller (e.g. forgot-password) neither leaks account existence nor 500s.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!isEmailConfigured()) {
    logger.warn(
      { to: mail.to, subject: mail.subject, body: mail.text },
      "Email not configured (GMAIL_* env vars) — logging instead of sending",
    );
    return false;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw: base64url(buildMime(mail)) }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gmail send ${res.status}: ${detail.slice(0, 400)}`);
    }
    const json = (await res.json()) as { id?: string };
    logger.info({ to: mail.to, id: json.id }, "Email sent");
    return true;
  } catch (error) {
    logger.error({ err: error, to: mail.to }, "Failed to send email");
    return false;
  }
}
