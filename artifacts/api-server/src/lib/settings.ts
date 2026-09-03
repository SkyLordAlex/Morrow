import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { sanitizeBlockedWeekdays } from "./planner/types.js";
import { logger } from "./logger.js";

export type ResolvedSettings = {
  defaultAvailableMinutes: number;
  blockedWeekdays: number[];
};

export const DEFAULT_SETTINGS: ResolvedSettings = {
  defaultAvailableMinutes: 90,
  blockedWeekdays: [],
};

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.defaultAvailableMinutes;
  return Math.min(480, Math.max(15, Math.round(value)));
}

/** A user's settings, falling back to defaults when they've saved none. */
export async function getUserSettings(
  userId: number,
): Promise<ResolvedSettings> {
  try {
    const [row] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId));

    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      defaultAvailableMinutes: clampMinutes(row.defaultAvailableMinutes),
      blockedWeekdays: sanitizeBlockedWeekdays(row.blockedWeekdays),
    };
  } catch (error) {
    // The most likely cause is the `user_settings` table not existing yet
    // (code deployed before `db push` ran). Don't take plan creation down for
    // it — fall back to defaults.
    logger.warn(
      { reason: error instanceof Error ? error.message : String(error) },
      "Could not read user settings; using defaults",
    );
    return { ...DEFAULT_SETTINGS };
  }
}

/** Upsert a partial settings patch and return the merged result. */
export async function saveUserSettings(
  userId: number,
  patch: Partial<ResolvedSettings>,
): Promise<ResolvedSettings> {
  const current = await getUserSettings(userId);
  const next: ResolvedSettings = {
    defaultAvailableMinutes:
      patch.defaultAvailableMinutes === undefined
        ? current.defaultAvailableMinutes
        : clampMinutes(patch.defaultAvailableMinutes),
    blockedWeekdays:
      patch.blockedWeekdays === undefined
        ? current.blockedWeekdays
        : sanitizeBlockedWeekdays(patch.blockedWeekdays),
  };

  await db
    .insert(userSettingsTable)
    .values({ userId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: { ...next, updatedAt: new Date() },
    });

  return next;
}
