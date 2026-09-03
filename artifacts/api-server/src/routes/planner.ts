import { Router, type IRouter } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import {
  CompleteStudySessionParams,
  CompleteStudySessionResponse,
  CreateStudyPlanBody,
  CreateStudyPlanResponse,
  GetPlannerDashboardResponse,
  RescheduleStudySessionBody,
  RescheduleStudySessionParams,
  RescheduleStudySessionResponse,
  UpdatePlannerTaskBody,
  UpdatePlannerTaskParams,
  UpdatePlannerTaskResponse,
} from "@workspace/api-zod";
import {
  assignmentsTable,
  db,
  studySessionsTable,
  studyTasksTable,
} from "@workspace/db";
import {
  addDaysKey,
  daysBetweenKeys,
  formatDateKey,
  formatDueLabel,
  greetingFor,
  resolveTimeZone,
  weekdayOfKey,
  zonedDateKey,
} from "../lib/zoned-time.js";
import {
  generatePlanFromNote,
  isAiPlanningConfigured,
} from "../lib/ai/plan.js";
import { rulePlan } from "../lib/planner/rules.js";
import {
  describeBlockedWeekdays,
  type GeneratedPlan,
  type PlannedAssignment,
} from "../lib/planner/types.js";
import { logger } from "../lib/logger.js";
import { currentUserId, requireAuth } from "../middlewares/require-auth.js";

const router: IRouter = Router();

// Every route below is per-user: no handler touches a row it can't tie back to
// `req.userId`.
router.use(requireAuth);

const ACCENTS = ["coral", "blue", "violet", "green", "amber"];

function startTimeFor(dateKeyValue: string, sessionNumber: number) {
  const day = weekdayOfKey(dateKeyValue);
  const base = day === 0 || day === 6 ? 10 : 16;
  const hour = base + Math.floor((sessionNumber * 50) / 60);
  const minute = (sessionNumber * 50) % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function endTime(startTime: string, minutes: number) {
  const [hour, minute] = startTime.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function dueStatus(
  dueDate: string,
  total: number,
  completed: number,
  todayKey: string,
) {
  if (completed >= total) return "complete";
  const days = daysBetweenKeys(todayKey, dueDate);
  return days <= 1 && completed < total * 0.5 ? "at_risk" : "on_track";
}

async function getAssignmentRows(userId: number) {
  return db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.userId, userId))
    .orderBy(asc(assignmentsTable.dueDate));
}

async function getSessionRows(userId: number) {
  return db
    .select({
      id: studySessionsTable.id,
      taskId: studySessionsTable.taskId,
      assignmentId: studySessionsTable.assignmentId,
      title: studyTasksTable.title,
      subject: assignmentsTable.subject,
      date: studySessionsTable.date,
      startTime: studySessionsTable.startTime,
      endTime: studySessionsTable.endTime,
      durationMinutes: studySessionsTable.durationMinutes,
      status: studySessionsTable.status,
    })
    .from(studySessionsTable)
    .innerJoin(studyTasksTable, eq(studyTasksTable.id, studySessionsTable.taskId))
    .innerJoin(assignmentsTable, eq(assignmentsTable.id, studySessionsTable.assignmentId))
    .where(eq(studySessionsTable.userId, userId))
    .orderBy(asc(studySessionsTable.date), asc(studySessionsTable.startTime));
}

async function updateAssignmentProgress(
  userId: number,
  assignmentId: number,
  todayKey: string,
) {
  const tasks = await db
    .select()
    .from(studyTasksTable)
    .where(
      and(
        eq(studyTasksTable.userId, userId),
        eq(studyTasksTable.assignmentId, assignmentId),
      ),
    );
  const completedMinutes = tasks
    .filter((task) => task.status === "done")
    .reduce((sum, task) => sum + task.durationMinutes, 0);
  const assignment = (await db
    .select()
    .from(assignmentsTable)
    .where(
      and(
        eq(assignmentsTable.userId, userId),
        eq(assignmentsTable.id, assignmentId),
      ),
    ))[0];
  if (!assignment) return;
  await db
    .update(assignmentsTable)
    .set({
      completedMinutes,
      status: dueStatus(
        assignment.dueDate,
        assignment.totalMinutes,
        completedMinutes,
        todayKey,
      ),
    })
    .where(
      and(
        eq(assignmentsTable.userId, userId),
        eq(assignmentsTable.id, assignmentId),
      ),
    );
}

function sessionView(
  row: Awaited<ReturnType<typeof getSessionRows>>[number],
  todayKey: string,
) {
  return {
    ...row,
    date: row.date,
    isToday: row.date === todayKey,
  };
}

async function buildDashboard(userId: number, timeZone: string) {
  const now = new Date();
  const todayKey = zonedDateKey(timeZone, now);
  const assignments = await getAssignmentRows(userId);
  const sessions = (await getSessionRows(userId)).map((row) =>
    sessionView(row, todayKey),
  );
  const todaySessions = sessions.filter(
    (session) => session.date === todayKey && session.status !== "complete",
  );
  const upcomingAssignments = assignments
    .filter((assignment) => assignment.dueDate >= todayKey && assignment.status !== "complete")
    .slice(0, 5)
    .map((assignment) => ({
      ...assignment,
      dueLabel: formatDueLabel(assignment.dueDate, todayKey),
    }));
  const workload = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysKey(todayKey, index);
    const daySessions = sessions.filter((session) => session.date === date && session.status !== "complete");
    return {
      date,
      dayLabel:
        index === 0 ? "Today" : formatDateKey(date, { weekday: "short" }),
      minutes: daySessions.reduce((sum, session) => sum + session.durationMinutes, 0),
      sessionCount: daySessions.length,
      isToday: index === 0,
    };
  });
  const completedSessions = sessions.filter((session) => session.status === "complete").length;
  const focusSession = todaySessions[0];
  const focus = focusSession
    ? {
        sessionId: focusSession.id,
        taskId: focusSession.taskId,
        title: focusSession.title,
        subject: focusSession.subject,
        startTime: focusSession.startTime,
        durationMinutes: focusSession.durationMinutes,
        context: `A ${focusSession.durationMinutes}-minute session to keep ${focusSession.subject} on track`,
      }
    : null;

  return GetPlannerDashboardResponse.parse({
    greeting: greetingFor(timeZone, now),
    dateLabel: formatDateKey(todayKey, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    todayFocus: focus,
    todaySessions,
    upcomingAssignments,
    workload,
    totalMinutesThisWeek: workload.reduce((sum, day) => sum + day.minutes, 0),
    completedSessions,
    streakDays: completedSessions > 0 ? 2 : 0,
  });
}

router.get("/planner/dashboard", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    res.json(await buildDashboard(userId, timeZone));
  } catch (error) {
    next(error);
  }
});

router.post("/planner/plans", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const input = CreateStudyPlanBody.parse(req.body);
    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    const todayKey = zonedDateKey(timeZone);
    const availableMinutes = input.availableMinutesPerDay ?? 90;

    // Real AI when a Gemini key is configured; the rule-based parser otherwise
    // or if the model call fails.
    let plan: GeneratedPlan;
    let planSource: "ai" | "rules" = "rules";
    if (isAiPlanningConfigured()) {
      try {
        plan = await generatePlanFromNote(
          input.note,
          todayKey,
          availableMinutes,
        );
        planSource = "ai";
      } catch (error) {
        logger.warn(
          { reason: error instanceof Error ? error.message : String(error) },
          "AI plan generation failed; falling back to the rule-based parser",
        );
        plan = rulePlan(input.note, todayKey);
      }
    } else {
      plan = rulePlan(input.note, todayKey);
    }

    const planned: PlannedAssignment[] = plan.assignments;
    const blockedWeekdays = plan.blockedWeekdays;
    const isBlockedDay = (dateKey: string) =>
      blockedWeekdays.includes(weekdayOfKey(dateKey));

    const assignments = [];
    const tasks = [];
    const sessions = [];
    let sessionNumber = 0;

    // Seed the day-by-day minute tally with what the student *already* has
    // scheduled from today onward, so new sessions fill the emptier days
    // instead of stacking onto ones that are already at capacity.
    const dayUsage = new Map<string, number>();
    const existingSessions = await db
      .select({
        date: studySessionsTable.date,
        durationMinutes: studySessionsTable.durationMinutes,
      })
      .from(studySessionsTable)
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          eq(studySessionsTable.status, "scheduled"),
          gte(studySessionsTable.date, todayKey),
        ),
      );
    for (const row of existingSessions) {
      dayUsage.set(
        row.date,
        (dayUsage.get(row.date) ?? 0) + row.durationMinutes,
      );
    }

    for (const [assignmentIndex, item] of planned.entries()) {
      const totalMinutes = item.tasks.reduce(
        (sum, task) => sum + task.durationMinutes,
        0,
      );
      const [assignment] = await db
        .insert(assignmentsTable)
        .values({
          userId,
          title: item.title,
          subject: item.subject,
          dueDate: item.dueDate,
          dueLabel: formatDueLabel(item.dueDate, todayKey),
          totalMinutes,
          completedMinutes: 0,
          status: "on_track",
          accent: ACCENTS[assignmentIndex % ACCENTS.length],
        })
        .returning();
      assignments.push({
        ...assignment,
        dueLabel: formatDueLabel(assignment.dueDate, todayKey),
      });

      for (const [taskIndex, plannedTask] of item.tasks.entries()) {
        const durationMinutes = plannedTask.durationMinutes;
        const [task] = await db
          .insert(studyTasksTable)
          .values({
            userId,
            assignmentId: assignment.id,
            title: plannedTask.title,
            durationMinutes,
            status: "todo",
            sortOrder: taskIndex,
          })
          .returning();
        tasks.push(task);

        // Date keys compare correctly as strings (YYYY-MM-DD is
        // lexicographically ordered), so the walk needs no Date objects.
        // Skip days the student said they can't study, and days already at
        // capacity — but never push past the due date.
        let candidateDate = todayKey;
        while (
          candidateDate < item.dueDate &&
          (isBlockedDay(candidateDate) ||
            (dayUsage.get(candidateDate) ?? 0) + durationMinutes >
              availableMinutes)
        ) {
          candidateDate = addDaysKey(candidateDate, 1);
        }
        if (candidateDate > item.dueDate) candidateDate = item.dueDate;
        // If the due date itself is a day the student can't study, back up to
        // the last day they can (never before today).
        while (candidateDate > todayKey && isBlockedDay(candidateDate)) {
          candidateDate = addDaysKey(candidateDate, -1);
        }
        const scheduledDate = candidateDate;
        dayUsage.set(scheduledDate, (dayUsage.get(scheduledDate) ?? 0) + durationMinutes);
        const startTime = startTimeFor(scheduledDate, sessionNumber % 3);
        sessionNumber += 1;
        const [session] = await db
          .insert(studySessionsTable)
          .values({
            userId,
            taskId: task.id,
            assignmentId: assignment.id,
            date: scheduledDate,
            startTime,
            endTime: endTime(startTime, durationMinutes),
            durationMinutes,
            status: "scheduled",
          })
          .returning();
        sessions.push({
          ...session,
          title: task.title,
          subject: assignment.subject,
          isToday: scheduledDate === todayKey,
        });
      }
    }

    const newDays = new Set(sessions.map((session) => session.date)).size;
    const avoiding = describeBlockedWeekdays(blockedWeekdays);
    const base =
      planSource === "ai"
        ? `I read your note and broke it into ${tasks.length} steps across ${newDays} study days, working around what you already had planned and keeping each day near ${availableMinutes} minutes`
        : `I mapped ${tasks.length} small steps across ${newDays} study days, working around your existing sessions and keeping each day under ${availableMinutes} minutes`;
    const summary = avoiding
      ? `${base}, and staying off ${avoiding}.`
      : `${base}.`;

    res.status(201).json(
      CreateStudyPlanResponse.parse({ assignments, tasks, sessions, summary }),
    );
  } catch (error) {
    next(error);
  }
});

router.delete("/planner/plans", async (req, res, next) => {
  try {
    // ON DELETE CASCADE on study_tasks.assignment_id and
    // study_sessions.assignment_id clears the tasks and sessions too.
    await db
      .delete(assignmentsTable)
      .where(eq(assignmentsTable.userId, currentUserId(req)));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/planner/tasks/:id", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const { id } = UpdatePlannerTaskParams.parse(req.params);
    const { status } = UpdatePlannerTaskBody.parse(req.body);
    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    const [task] = await db
      .update(studyTasksTable)
      .set({ status })
      .where(and(eq(studyTasksTable.id, id), eq(studyTasksTable.userId, userId)))
      .returning();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await updateAssignmentProgress(userId, task.assignmentId, zonedDateKey(timeZone));
    if (status === "done") {
      await db
        .update(studySessionsTable)
        .set({ status: "complete" })
        .where(
          and(
            eq(studySessionsTable.taskId, id),
            eq(studySessionsTable.userId, userId),
          ),
        );
    }
    res.json(UpdatePlannerTaskResponse.parse(task));
  } catch (error) {
    next(error);
  }
});

router.post("/planner/sessions/:id/complete", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const { id } = CompleteStudySessionParams.parse(req.params);
    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    const [session] = await db
      .update(studySessionsTable)
      .set({ status: "complete" })
      .where(
        and(
          eq(studySessionsTable.id, id),
          eq(studySessionsTable.userId, userId),
        ),
      )
      .returning();
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await db
      .update(studyTasksTable)
      .set({ status: "done" })
      .where(
        and(
          eq(studyTasksTable.id, session.taskId),
          eq(studyTasksTable.userId, userId),
        ),
      );
    await updateAssignmentProgress(userId, session.assignmentId, zonedDateKey(timeZone));
    const [view] = (await getSessionRows(userId))
      .filter((row) => row.id === id)
      .map((row) => sessionView(row, zonedDateKey(timeZone)));
    res.json(CompleteStudySessionResponse.parse(view));
  } catch (error) {
    next(error);
  }
});

router.post("/planner/sessions/:id/reschedule", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const { id } = RescheduleStudySessionParams.parse(req.params);
    const { date } = RescheduleStudySessionBody.parse(req.body);
    const timeZone = resolveTimeZone(req.get("x-time-zone"));
    // The generated type says Date, but a date-format field arrives as a
    // "YYYY-MM-DD" string. Handle both rather than assuming.
    const dateValue =
      typeof date === "string" ? date : date.toISOString().slice(0, 10);
    const [session] = await db
      .update(studySessionsTable)
      .set({ date: dateValue, status: "scheduled" })
      .where(
        and(
          eq(studySessionsTable.id, id),
          eq(studySessionsTable.userId, userId),
        ),
      )
      .returning();
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const [view] = (await getSessionRows(userId))
      .filter((row) => row.id === id)
      .map((row) => sessionView(row, zonedDateKey(timeZone)));
    res.json(RescheduleStudySessionResponse.parse(view));
  } catch (error) {
    next(error);
  }
});

export default router;
