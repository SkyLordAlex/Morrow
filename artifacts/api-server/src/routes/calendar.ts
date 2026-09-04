import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  assignmentsTable,
  db,
  studySessionsTable,
  studyTasksTable,
} from "@workspace/db";
import { buildCalendar, type CalendarEvent } from "../lib/ical.js";
import { findUserIdByCalendarToken } from "../lib/settings.js";

const router: IRouter = Router();

// Public, token-gated: calendar apps subscribe by URL and can't send an
// Authorization header. The token is the credential; a bad one is a plain 404.
router.get("/calendar/:token", async (req, res, next) => {
  try {
    const token = req.params.token.replace(/\.ics$/i, "");
    const userId = await findUserIdByCalendarToken(token);
    if (userId === null) {
      res.status(404).type("text/plain").send("Unknown calendar");
      return;
    }

    const rows = await db
      .select({
        id: studySessionsTable.id,
        date: studySessionsTable.date,
        startTime: studySessionsTable.startTime,
        endTime: studySessionsTable.endTime,
        durationMinutes: studySessionsTable.durationMinutes,
        status: studySessionsTable.status,
        title: studyTasksTable.title,
        subject: assignmentsTable.subject,
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
      .where(eq(studySessionsTable.userId, userId))
      .orderBy(asc(studySessionsTable.date), asc(studySessionsTable.startTime));

    const events: CalendarEvent[] = rows.map((row) => {
      const done = row.status === "complete";
      return {
        uid: `morrow-session-${row.id}@morrow.study`,
        start: row.date.slice(0, 10),
        startTime: row.startTime,
        endTime: row.endTime,
        summary: done ? `✓ ${row.title}` : row.title,
        description: `${row.subject} · ${row.durationMinutes} min${
          done ? " · done" : ""
        }`,
        done,
      };
    });

    res
      .status(200)
      .type("text/calendar; charset=utf-8")
      .set("Content-Disposition", 'inline; filename="morrow.ics"')
      .set("Cache-Control", "private, max-age=300")
      .send(buildCalendar("Morrow study plan", events));
  } catch (error) {
    next(error);
  }
});

export default router;
