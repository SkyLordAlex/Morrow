import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger.js";

// Transactional email over Gmail SMTP. Set GMAIL_USER (the full address) and
// GMAIL_APP_PASSWORD (a 16-char App Password from a Google account with
// 2-Step Verification on). When unset, mail is logged instead of sent so the
// flow is still testable locally.

const GMAIL_USER = process.env["GMAIL_USER"];
const GMAIL_APP_PASSWORD = process.env["GMAIL_APP_PASSWORD"];
const FROM_NAME = process.env["EMAIL_FROM_NAME"] || "Morrow";

export function isEmailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

let cached: Transporter | null = null;

function transport(): Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        // Gmail App Passwords are often shown with spaces; strip them.
        pass: (GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, ""),
      },
    });
  }
  return cached;
}

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send an email. Never throws — a delivery failure is logged and swallowed so
 * callers (e.g. the forgot-password route) don't leak whether an address
 * exists or break on a transient SMTP error.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!isEmailConfigured()) {
    logger.warn(
      { to: mail.to, subject: mail.subject, body: mail.text },
      "Email not configured (GMAIL_USER / GMAIL_APP_PASSWORD) — logging instead of sending",
    );
    return false;
  }

  try {
    const info = await transport().sendMail({
      from: `"${FROM_NAME}" <${GMAIL_USER}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    logger.info(
      { to: mail.to, messageId: info.messageId },
      "Email sent",
    );
    return true;
  } catch (error) {
    logger.error(
      { err: error, to: mail.to },
      "Failed to send email",
    );
    return false;
  }
}
