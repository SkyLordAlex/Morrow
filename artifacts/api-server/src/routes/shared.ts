import { Router, type IRouter } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import {
  assignmentsTable,
  db,
  studySessionsTable,
  studyTasksTable,
  usersTable,
} from "@workspace/db";
import { GetSharedPlanResponse } from "@workspace/api-zod";
import { formatDueLabel, resolveTimeZone, zonedDateKey } from "../lib/zoned-time.js";
import { findUserIdByShareToken } from "../lib/settings.js";

const router: IRouter = Router();

// Public, token-gated read-only view of someone's planner. No auth — the
// unguessable token in the URL is the only credential, and a bad one is a 404.
router.get("/shared/:token", async (req, res, next) => {
  try {
    const userId = await findUserIdByShareToken(req.params.token);
    if (userId === null) {
      res.status(404).json({ error: "This plan link isn't active." });
      return;
    }

    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    const todayKey = zonedDateKey(timeZone);

    const [owner] = await db
      .select({ displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const assignmentRows = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.userId, userId))
      .orderBy(asc(assignmentsTable.dueDate));

    const sessionRows = await db
      .select({
        title: studyTasksTable.title,
        subject: assignmentsTable.subject,
        date: studySessionsTable.date,
        startTime: studySessionsTable.startTime,
        durationMinutes: studySessionsTable.durationMinutes,
        accent: assignmentsTable.accent,
      })
      .from(studySessionsTable)
      .innerJoin(
        studyTasksTable,
        eq(studyTasksTable.id, studySessionsTable.taskId),
      )
      .innerJoin(
        assignmentsTable,
        eq(assignmentsTable.id, studySessionsTable.assignmentId),
      )
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          eq(studySessionsTable.status, "scheduled"),
          gte(studySessionsTable.date, todayKey),
        ),
      )
      .orderBy(asc(studySessionsTable.date), asc(studySessionsTable.startTime));

    const assignments = assignmentRows
      .filter((row) => row.status !== "complete")
      .map((row) => {
        const progress = row.totalMinutes
          ? Math.round((row.completedMinutes / row.totalMinutes) * 100)
          : 0;
        return {
          title: row.title,
          subject: row.subject,
          dueLabel: formatDueLabel(row.dueDate, todayKey),
          progress: Math.min(100, Math.max(0, progress)),
          accent: row.accent,
        };
      });

    const upcoming = sessionRows.slice(0, 12).map((row) => ({
      title: row.title,
      subject: row.subject,
      date: row.date.slice(0, 10),
      startTime: row.startTime,
      durationMinutes: row.durationMinutes,
      accent: row.accent,
    }));

    res.json(
      GetSharedPlanResponse.parse({
        ownerName: owner?.displayName ?? null,
        assignments,
        upcoming,
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
