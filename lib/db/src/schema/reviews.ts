import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./auth";

// One review per user (rating 1-5 + optional text). `user_id` is unique, so
// submitting again updates the existing row rather than adding another.
export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("reviews_user_unique").on(table.userId)],
);

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
});

export type Review = typeof reviewsTable.$inferSelect;
