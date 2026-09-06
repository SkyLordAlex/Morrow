import { logger } from "./logger.js";

// Transactional email over an HTTPS API (SMTP is blocked on hosts like
// Render's free tier). Two providers are supported; the first one configured
// wins. When neither is set, mail is logged instead of sent so the
// forgot-password flow stays testable.
//
//   Brevo (recommended — free 300/day, no domain, verify one sender):
//     BREVO_API_KEY, EMAIL_FROM   (a sender address verified in Brevo)
//
//   Gmail API (sends from a real Gmail account):
//     GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//
//   EMAIL_FROM_NAME  — optional display name, defaults to "Morrow".

const FROM_NAME = process.env["EMAIL_FROM_NAME"] || "Morrow";

const BREVO_API_KEY = process.env["BREVO_API_KEY"];
const EMAIL_FROM = process.env["EMAIL_FROM"];

const GMAIL_USER = process.env["GMAIL_USER"];
const GMAIL_CLIENT_ID = process.env["GMAIL_CLIENT_ID"];
const GMAIL_CLIENT_SECRET = process.env["GMAIL_CLIENT_SECRET"];
const GMAIL_REFRESH_TOKEN = process.env["GMAIL_REFRESH_TOKEN"];

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function provider(): "brevo" | "gmail" | null {
  if (BREVO_API_KEY && EMAIL_FROM) return "brevo";
  if (
    GMAIL_USER &&
    GMAIL_CLIENT_ID &&
    GMAIL_CLIENT_SECRET &&
    GMAIL_REFRESH_TOKEN
  ) {
    return "gmail";
  }
  return null;
}

export function isEmailConfigured(): boolean {
  return provider() !== null;
}

// --- Brevo -----------------------------------------------------------------

async function sendViaBrevo(mail: Mail): Promise<string> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY as string,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: EMAIL_FROM },
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      ...(mail.html ? { htmlContent: mail.html } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as { messageId?: string };
  return json.messageId ?? "sent";
}

// --- Gmail API -----------------------------------------------------------

let gmailToken: { value: string; expiresAt: number } | null = null;

async function gmailAccessToken(): Promise<string> {
  if (gmailToken && gmailToken.expiresAt - 60_000 > Date.now()) {
    return gmailToken.value;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID ?? "",
      client_secret: GMAIL_CLIENT_SECRET ?? "",
      refresh_token: GMAIL_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
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
  gmailToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return gmailToken.value;
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

async function sendViaGmail(mail: Mail): Promise<string> {
  const token = await gmailAccessToken();
  const raw = Buffer.from(buildMime(mail), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gmail send ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? "sent";
}

// --- Public --------------------------------------------------------------

/**
 * Send an email. Never throws — a failure is logged and returns false so the
 * caller (e.g. forgot-password) neither leaks account existence nor 500s.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const which = provider();
  if (!which) {
    logger.warn(
      { to: mail.to, subject: mail.subject, body: mail.text },
      "Email not configured (BREVO_API_KEY/EMAIL_FROM or GMAIL_*) — logging instead of sending",
    );
    return false;
  }

  try {
    const id =
      which === "brevo" ? await sendViaBrevo(mail) : await sendViaGmail(mail);
    logger.info({ to: mail.to, id, via: which }, "Email sent");
    return true;
  } catch (error) {
    logger.error({ err: error, to: mail.to, via: which }, "Failed to send email");
    return false;
  }
}
