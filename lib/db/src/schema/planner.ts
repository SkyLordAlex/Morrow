import { integer, pgTable, serial, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./auth";

// Every planner row is owned by exactly one user. `onDelete: "cascade"` means
// deleting an account (see routes/auth.ts `DELETE /auth/account`) clears all of
// their planner data in one statement.
const userId = () =>
  integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" });

export const assignmentsTable = pgTable("study_assignments", {
  id: serial("id").primaryKey(),
  userId: userId(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  dueDate: date("due_date").notNull(),
  dueLabel: text("due_label").notNull(),
  totalMinutes: integer("total_minutes").notNull(),
  completedMinutes: integer("completed_minutes").notNull().default(0),
  status: text("status").notNull().default("on_track"),
  accent: text("accent").notNull().default("indigo"),
});

export const studyTasksTable = pgTable("study_tasks", {
  id: serial("id").primaryKey(),
  userId: userId(),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignmentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: text("status").notNull().default("todo"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const studySessionsTable = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: userId(),
  taskId: integer("task_id")
    .notNull()
    .references(() => studyTasksTable.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignmentsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: text("status").notNull().default("scheduled"),
});

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({
  id: true,
});
export const insertStudyTaskSchema = createInsertSchema(studyTasksTable).omit({
  id: true,
});
export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({
  id: true,
});

export type Assignment = typeof assignmentsTable.$inferSelect;
export type StudyTask = typeof studyTasksTable.$inferSelect;
export type StudySession = typeof studySessionsTable.$inferSelect;