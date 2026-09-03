import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./auth";

// One row per user holding their preferences. Created lazily the first time a
// user saves a setting; `GET /settings` returns sensible defaults when no row
// exists yet. Cascade-deleted with the account.
export const userSettingsTable = pgTable("user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // Fallback for the "time I have each day" field in the plan composer.
  defaultAvailableMinutes: integer("default_available_minutes")
    .notNull()
    .default(90),

  // Weekday numbers (0=Sunday..6=Saturday) the user never studies on. Merged
  // into every new plan on top of anything the note itself mentions.
  blockedWeekdays: jsonb("blocked_weekdays")
    .$type<number[]>()
    .notNull()
    .default([]),

  // When study sessions start each day: "morning" | "afternoon" | "evening".
  preferredTime: text("preferred_time").notNull().default("afternoon"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable);

export type UserSettings = typeof userSettingsTable.$inferSelect;
