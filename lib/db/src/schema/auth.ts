import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Accounts. `passwordHash` is null for accounts that only ever signed in with
// Apple or Google. `email` is stored lowercased and is the identity we link
// providers on — Apple and Google both hand back a verified email.
export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash"),
    // "user" | "admin". Admins can moderate reviews and see the admin console.
    // Granted automatically to addresses in the ADMIN_EMAILS env var, or by
    // another admin.
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export type UserRole = "user" | "admin";

// One row per (provider, provider-account) pair, linked to a user. A single
// user can have both an `apple` and a `google` identity.
export const identitiesTable = pgTable(
  "user_identities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_identities_provider_subject_unique").on(
      table.provider,
      table.subject,
    ),
  ],
);

// Opaque bearer sessions. The client holds the raw token; we only store its
// SHA-256 hash, so a database leak doesn't hand out live sessions.
export const sessionsTable = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
});
export const insertIdentitySchema = createInsertSchema(identitiesTable).omit({
  id: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
});

export type User = typeof usersTable.$inferSelect;
export type Identity = typeof identitiesTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;

export type AuthProvider = "apple" | "google";
