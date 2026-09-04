import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { sanitizeBlockedWeekdays } from "./planner/types.js";
import { logger } from "./logger.js";

export type PreferredTime = "morning" | "afternoon" | "evening";

export type ResolvedSettings = {
  defaultAvailableMinutes: number;
  blockedWeekdays: number[];
  preferredTime: PreferredTime;
  calendarToken: string | null;
};

export const DEFAULT_SETTINGS: ResolvedSettings = {
  defaultAvailableMinutes: 90,
  blockedWeekdays: [],
  preferredTime: "afternoon",
  calendarToken: null,
};

// The clock hour study sessions start at for each preference.
export const START_HOUR: Record<PreferredTime, number> = {
  morning: 8,
  afternoon: 13,
  evening: 18,
};

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.defaultAvailableMinutes;
  return Math.min(480, Math.max(15, Math.round(value)));
}

function coercePreferredTime(value: unknown): PreferredTime {
  return value === "morning" || value === "afternoon" || value === "evening"
    ? value
    : DEFAULT_SETTINGS.preferredTime;
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
      preferredTime: coercePreferredTime(row.preferredTime),
      calendarToken: row.calendarToken ?? null,
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
    preferredTime:
      patch.preferredTime === undefined
        ? current.preferredTime
        : coercePreferredTime(patch.preferredTime),
    calendarToken: current.calendarToken,
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

/**
 * Turn the iCalendar feed on (minting a fresh token) or off. Rotating simply
 * calls this with `enabled: true` again — the old URL stops working.
 */
export async function setCalendarFeed(
  userId: number,
  enabled: boolean,
): Promise<string | null> {
  const token = enabled ? randomBytes(24).toString("base64url") : null;
  await db
    .insert(userSettingsTable)
    .values({ userId, calendarToken: token, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: { calendarToken: token, updatedAt: new Date() },
    });
  return token;
}

export async function findUserIdByCalendarToken(
  token: string,
): Promise<number | null> {
  if (!token) return null;
  const [row] = await db
    .select({ userId: userSettingsTable.userId })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.calendarToken, token));
  return row?.userId ?? null;
}
