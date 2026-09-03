import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

// Opaque bearer sessions. The raw token never touches the database — we store
// only its SHA-256 hash, so a leaked `sessions` table can't be used to log in.

const DEFAULT_TTL_DAYS = 30;

function ttlMs(): number {
  const days = Number(process.env["SESSION_TTL_DAYS"]);
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a session for `userId` and return the raw token to hand to the client. */
export async function issueSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs()),
    lastUsedAt: new Date(),
  });
  return token;
}

/**
 * Resolve a raw bearer token to its user id, or null if it's unknown or
 * expired. Bumps `lastUsedAt` and lazily deletes the row when expired.
 */
export async function resolveSession(token: string): Promise<number | null> {
  const tokenHash = hashToken(token);
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.tokenHash, tokenHash))
    .limit(1);

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    return null;
  }

  await db
    .update(sessionsTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessionsTable.id, session.id));

  return session.userId;
}

/** Revoke a single session (sign out). */
export async function revokeSession(token: string): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashToken(token)));
}

/** Revoke every session for a user (e.g. on account deletion). */
export async function revokeAllForUser(userId: number): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

/** Housekeeping: drop expired rows. Safe to call opportunistically. */
export async function purgeExpiredSessions(): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()));
}
