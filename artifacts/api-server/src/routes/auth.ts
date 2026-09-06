import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import {
  AuthAppleBody,
  AuthGoogleBody,
  GetAuthSessionResponse,
  LoginBody,
  LoginResponse,
  ChangePasswordBody,
  ForgotPasswordBody,
  RegisterBody,
  RegisterResponse,
  ResetPasswordBody,
  UpdateAccountBody,
  UpdateAccountResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import {
  consumeResetToken,
  createResetToken,
} from "../lib/auth/password-reset.js";
import { sendMail } from "../lib/email.js";
import {
  AuthConfigError,
  verifyAppleIdentityToken,
  verifyGoogleIdToken,
} from "../lib/auth/providers.js";
import {
  issueSession,
  revokeAllForUser,
  revokeSession,
} from "../lib/auth/tokens.js";
import {
  createUserWithPassword,
  ensureAdminForEmail,
  findOrCreateUserByIdentity,
  findUserByEmail,
  findUserById,
  normalizeEmail,
  toPublicUser,
} from "../lib/auth/users.js";
import { bearerToken, currentUserId, requireAuth } from "../middlewares/require-auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function isZodError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

router.post("/auth/register", async (req, res, next) => {
  try {
    const input = RegisterBody.parse(req.body);
    const email = normalizeEmail(input.email);

    if (await findUserByEmail(email)) {
      res.status(409).json({ error: "That email is already registered." });
      return;
    }

    const user = await ensureAdminForEmail(
      await createUserWithPassword(email, input.password, input.displayName),
    );
    const token = await issueSession(user.id);
    res
      .status(201)
      .json(RegisterResponse.parse({ token, user: await toPublicUser(user) }));
  } catch (error) {
    if (isZodError(error)) {
      res
        .status(400)
        .json({ error: "Enter a valid email and a password of at least 8 characters." });
      return;
    }
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const input = LoginBody.parse(req.body);
    const user = await findUserByEmail(input.email);
    const ok = user
      ? await verifyPassword(input.password, user.passwordHash)
      : false;

    if (!user || !ok) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    const graded = await ensureAdminForEmail(user);
    const token = await issueSession(graded.id);
    res.json(LoginResponse.parse({ token, user: await toPublicUser(graded) }));
  } catch (error) {
    if (isZodError(error)) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    next(error);
  }
});

function resetLinkBase(req: Request): string {
  const configured = process.env["WEB_APP_URL"]?.replace(/\/+$/, "");
  if (configured) return configured;
  const origin = req.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "";
}

// Always 204, whether or not the email exists — no account enumeration. When
// the account exists and has an email we can reach, a reset link is sent.
router.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = ForgotPasswordBody.parse(req.body);

    // Everything after validation is best-effort: a missing table (deployed
    // ahead of `db push`), an SMTP hiccup, or an unknown address must all look
    // identical to the caller — a plain 204.
    try {
      const user = await findUserByEmail(email);
      logger.info(
        { email: normalizeEmail(email), matched: Boolean(user) },
        "forgot-password requested",
      );
      if (user) {
        const token = await createResetToken(user.id);
        const base = resetLinkBase(req);
        const link = `${base}/reset-password?token=${token}`;
        const name = user.displayName?.trim() || "there";
        const sent = await sendMail({
          to: user.email,
          subject: "Reset your Morrow password",
          text: [
            `Hi ${name},`,
            "",
            "Use this link to set a new password. It expires in 1 hour.",
            "",
            link,
            "",
            "If you didn't ask for this, you can ignore this email — your password won't change.",
          ].join("\n"),
          html: [
            `<p>Hi ${name},</p>`,
            "<p>Use this link to set a new password. It expires in 1 hour.</p>",
            `<p><a href="${link}">Reset your password</a></p>`,
            "<p style=\"color:#667\">If you didn't ask for this, you can ignore this email — your password won't change.</p>",
          ].join(""),
        });
        logger.info({ to: user.email, sent }, "forgot-password: reset email");
      }
    } catch (inner) {
      logger.error({ err: inner }, "forgot-password: could not send reset link");
    }

    res.status(204).end();
  } catch (error) {
    if (isZodError(error)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    next(error);
  }
});

router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = ResetPasswordBody.parse(req.body);
    const userId = await consumeResetToken(token);
    if (userId === null) {
      res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
      return;
    }

    await db
      .update(usersTable)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(usersTable.id, userId));
    // Sign out everywhere — a reset usually means "someone else had access".
    await revokeAllForUser(userId);

    res.status(204).end();
  } catch (error) {
    if (isZodError(error)) {
      res
        .status(400)
        .json({ error: "Choose a new password of at least 8 characters." });
      return;
    }
    next(error);
  }
});

router.post("/auth/apple", async (req, res, next) => {
  try {
    const { identityToken } = AuthAppleBody.parse(req.body);
    const identity = await verifyAppleIdentityToken(identityToken);
    const user = await ensureAdminForEmail(
      await findOrCreateUserByIdentity("apple", identity),
    );
    const token = await issueSession(user.id);
    res.json(LoginResponse.parse({ token, user: await toPublicUser(user) }));
  } catch (error) {
    if (error instanceof AuthConfigError) {
      logger.error({ err: error }, "Apple sign-in is not configured");
      res.status(500).json({ error: "Apple sign-in is not configured on the server." });
      return;
    }
    if (isZodError(error)) {
      res.status(400).json({ error: "An Apple identity token is required." });
      return;
    }
    logger.warn({ err: error }, "Apple identity token rejected");
    res.status(401).json({ error: "Could not verify your Apple sign-in." });
  }
});

router.post("/auth/google", async (req, res, next) => {
  try {
    const { idToken } = AuthGoogleBody.parse(req.body);
    const identity = await verifyGoogleIdToken(idToken);
    const user = await ensureAdminForEmail(
      await findOrCreateUserByIdentity("google", identity),
    );
    const token = await issueSession(user.id);
    res.json(LoginResponse.parse({ token, user: await toPublicUser(user) }));
  } catch (error) {
    if (error instanceof AuthConfigError) {
      logger.error({ err: error }, "Google sign-in is not configured");
      res.status(500).json({ error: "Google sign-in is not configured on the server." });
      return;
    }
    if (isZodError(error)) {
      res.status(400).json({ error: "A Google ID token is required." });
      return;
    }
    logger.warn({ err: error }, "Google ID token rejected");
    res.status(401).json({ error: "Could not verify your Google sign-in." });
  }
});

router.get("/auth/session", requireAuth, async (req, res, next) => {
  try {
    const found = await findUserById(currentUserId(req));
    if (!found) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await ensureAdminForEmail(found);
    res.json(GetAuthSessionResponse.parse(await toPublicUser(user)));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", requireAuth, async (req, res, next) => {
  try {
    const token = bearerToken(req.get("authorization"));
    if (token) await revokeSession(token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/auth/account", requireAuth, async (req, res, next) => {
  try {
    const input = UpdateAccountBody.parse(req.body);
    const displayName = input.displayName.trim().slice(0, 80);
    if (!displayName) {
      res.status(400).json({ error: "Your name can't be empty." });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ displayName })
      .where(eq(usersTable.id, currentUserId(req)))
      .returning();
    if (!updated) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.json(UpdateAccountResponse.parse(await toPublicUser(updated)));
  } catch (error) {
    if (isZodError(error)) {
      res.status(400).json({ error: "Enter a name of at most 80 characters." });
      return;
    }
    next(error);
  }
});

router.post("/auth/password", requireAuth, async (req, res, next) => {
  try {
    const input = ChangePasswordBody.parse(req.body);
    const user = await findUserById(currentUserId(req));
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Accounts that already have a password must prove they know it. A
    // social-only account is instead *setting* one for the first time.
    if (user.passwordHash) {
      const current = input.currentPassword ?? "";
      if (!(await verifyPassword(current, user.passwordHash))) {
        res.status(400).json({ error: "Your current password is incorrect." });
        return;
      }
    }

    await db
      .update(usersTable)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(usersTable.id, user.id));

    res.status(204).end();
  } catch (error) {
    if (isZodError(error)) {
      res
        .status(400)
        .json({ error: "Choose a new password of at least 8 characters." });
      return;
    }
    next(error);
  }
});

router.delete("/auth/account", requireAuth, async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    await revokeAllForUser(userId);
    // Planner rows, identities, and any remaining sessions are removed by the
    // ON DELETE CASCADE foreign keys.
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
