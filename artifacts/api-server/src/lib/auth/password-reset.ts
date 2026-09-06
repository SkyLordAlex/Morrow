import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, passwordResetTokensTable } from "@workspace/db";

// Single-use, time-limited password-reset tokens. The raw token goes in the
// email link; only its SHA-256 hash is stored.

const TTL_MINUTES = 60;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mint a reset token for a user. Older unused tokens for them are cleared. */
export async function createResetToken(userId: number): Promise<string> {
  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, userId),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokensTable).values({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
  });
  return token;
}

/**
 * Validate a reset token and mark it used. Returns the user id on success, or
 * null if the token is unknown, already used, or expired.
 */
export async function consumeResetToken(
  token: string,
): Promise<number | null> {
  if (!token) return null;

  try {
    const [row] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.tokenHash, hash(token)))
      .limit(1);

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, row.id));

    return row.userId;
  } catch {
    // Table missing (deployed ahead of `db push`) — no valid token can exist.
    return null;
  }
}

/** Housekeeping: drop expired rows. */
export async function purgeExpiredResetTokens(): Promise<void> {
  await db
    .delete(passwordResetTokensTable)
    .where(lt(passwordResetTokensTable.expiresAt, new Date()));
}
