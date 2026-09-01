import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
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

const router: IRouter = Router();

const SUBJECTS = [
  "biology",
  "math",
  "history",
  "english",
  "chemistry",
  "physics",
  "computer science",
  "art",
  "geography",
  "psychology",
];

const ACCENTS = ["coral", "blue", "violet", "green", "amber"];

type ParsedAssignment = {
  title: string;
  subject: string;
  dueDate: string;
  dueLabel: string;
  kind: string;
  taskTitles: string[];
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDueLabel(dueDate: string, today = startOfDay()) {
  const due = startOfDay(new Date(`${dueDate}T12:00:00`));
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) {
    return `Due ${due.toLocaleDateString("en-US", { weekday: "long" })}`;
  }
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseDueDate(clause: string, today: Date) {
  const normalized = clause.toLowerCase();
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const weekdayIndex = weekdays.findIndex((day) => normalized.includes(day));
  if (weekdayIndex >= 0) {
    const currentDay = today.getDay();
    let daysAhead = (weekdayIndex - currentDay + 7) % 7;
    if (daysAhead === 0 && !normalized.includes("today")) daysAhead = 7;
    return dateKey(addDays(today, daysAhead));
  }
  if (normalized.includes("tomorrow")) return dateKey(addDays(today, 1));
  if (normalized.includes("today")) return dateKey(today);
  if (normalized.includes("next week")) {
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    return dateKey(addDays(today, daysUntilMonday));
  }
  return dateKey(addDays(today, 3));
}

function taskBlueprint(kind: string) {
  if (kind === "test" || kind === "exam" || kind === "quiz") {
    return [
      ["Review class notes", 35],
      ["Make a one-page study guide", 30],
      ["Practice recall questions", 35],
      ["Do a timed review", 20],
    ] as const;
  }
  if (kind === "project" || kind === "presentation") {
    return [
      ["Choose a direction", 30],
      ["Gather sources and examples", 45],
      ["Build a rough outline", 35],
      ["Draft the main work", 45],
      ["Revise and polish", 25],
    ] as const;
  }
  if (kind === "paper" || kind === "essay") {
    return [
      ["Choose a topic and question", 25],
      ["Gather evidence", 40],
      ["Write an outline", 25],
      ["Draft the argument", 45],
      ["Edit for clarity", 25],
    ] as const;
  }
  return [
    ["Understand the instructions", 15],
    ["Complete the first half", 25],
    ["Finish the work", 25],
    ["Check answers and submit", 15],
  ] as const;
}

function parseAssignments(note: string, today: Date): ParsedAssignment[] {
  const clauses = note
    .replace(/^\s*i\s+have\s+/i, "")
    .replace(/,\s+and\s+/gi, ", ")
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return clauses.map((clause, index) => {
    const normalized = clause.replace(/^(a|an|the)\s+/i, "").trim();
    const subjectMatch = SUBJECTS.find((subject) =>
      normalized.toLowerCase().includes(subject),
    );
    const kindMatch = normalized.match(
      /\b(test|exam|homework|project|paper|essay|quiz|presentation|assignment)\b/i,
    );
    const kind = (kindMatch?.[1] ?? "assignment").toLowerCase();
    const subject = subjectMatch
      ? capitalize(subjectMatch)
      : capitalize(normalized.split(/\s+/)[0] ?? `Subject ${index + 1}`);
    const dueDate = parseDueDate(normalized, today);
    const beforeDue = normalized
      .split(/\bdue\b|\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i)[0]
      .trim()
      .replace(/[.!?]+$/, "");
    const fallbackTitle = `${subject} ${kind}`;
    const title = beforeDue.length >= 4 ? capitalize(beforeDue) : fallbackTitle;

    return {
      title,
      subject,
      dueDate,
      dueLabel: formatDueLabel(dueDate, today),
      kind,
      taskTitles: taskBlueprint(kind).map(([taskTitle]) => taskTitle),
    };
  });
}

function startTimeFor(date: Date, sessionNumber: number) {
  const day = date.getDay();
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

function dueStatus(dueDate: string, total: number, completed: number) {
  if (completed >= total) return "complete";
  const days = Math.ceil(
    (startOfDay(new Date(`${dueDate}T12:00:00`)).getTime() - startOfDay().getTime()) /
      86_400_000,
  );
  return days <= 1 && completed < total * 0.5 ? "at_risk" : "on_track";
}

async function ensureSeedData() {
  const existing = await db.select({ id: assignmentsTable.id }).from(assignmentsTable).limit(1);
  if (existing.length > 0) return;

  const today = startOfDay();
  const seed = [
    {
      title: "Biology test",
      subject: "Biology",
      dueDate: dateKey(addDays(today, 3)),
      dueLabel: formatDueLabel(dateKey(addDays(today, 3)), today),
      kind: "test",
      accent: "coral",
    },
    {
      title: "Math homework",
      subject: "Math",
      dueDate: dateKey(addDays(today, 2)),
      dueLabel: formatDueLabel(dateKey(addDays(today, 2)), today),
      kind: "homework",
      accent: "blue",
    },
    {
      title: "History project",
      subject: "History",
      dueDate: dateKey(addDays(today, 7)),
      dueLabel: formatDueLabel(dateKey(addDays(today, 7)), today),
      kind: "project",
      accent: "violet",
    },
  ];

  for (const [assignmentIndex, item] of seed.entries()) {
    const blueprint = taskBlueprint(item.kind);
    const totalMinutes = blueprint.reduce((sum, [, minutes]) => sum + minutes, 0);
    const [assignment] = await db
      .insert(assignmentsTable)
      .values({
        title: item.title,
        subject: item.subject,
        dueDate: item.dueDate,
        dueLabel: item.dueLabel,
        totalMinutes,
        completedMinutes: 0,
        status: "on_track",
        accent: item.accent,
      })
      .returning();

    for (const [taskIndex, [taskTitle, durationMinutes]] of blueprint.entries()) {
      const [task] = await db
        .insert(studyTasksTable)
        .values({
          assignmentId: assignment.id,
          title: taskTitle,
          durationMinutes,
          status: "todo",
          sortOrder: taskIndex,
        })
        .returning();
      const sessionDate = addDays(today, Math.min(taskIndex % 4, assignmentIndex + 2));
      const startTime = startTimeFor(sessionDate, taskIndex);
      await db.insert(studySessionsTable).values({
        taskId: task.id,
        assignmentId: assignment.id,
        date: dateKey(sessionDate),
        startTime,
        endTime: endTime(startTime, durationMinutes),
        durationMinutes,
        status: "scheduled",
      });
    }
  }
}

async function getAssignmentRows() {
  return db.select().from(assignmentsTable).orderBy(asc(assignmentsTable.dueDate));
}

async function getSessionRows() {
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
    .orderBy(asc(studySessionsTable.date), asc(studySessionsTable.startTime));
}

async function updateAssignmentProgress(assignmentId: number) {
  const tasks = await db
    .select()
    .from(studyTasksTable)
    .where(eq(studyTasksTable.assignmentId, assignmentId));
  const completedMinutes = tasks
    .filter((task) => task.status === "done")
    .reduce((sum, task) => sum + task.durationMinutes, 0);
  const assignment = (await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, assignmentId)))[0];
  if (!assignment) return;
  await db
    .update(assignmentsTable)
    .set({
      completedMinutes,
      status: dueStatus(assignment.dueDate, assignment.totalMinutes, completedMinutes),
    })
    .where(eq(assignmentsTable.id, assignmentId));
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

async function buildDashboard() {
  await ensureSeedData();
  const today = startOfDay();
  const todayKey = dateKey(today);
  const assignments = await getAssignmentRows();
  const sessions = (await getSessionRows()).map((row) => sessionView(row, todayKey));
  const todaySessions = sessions.filter(
    (session) => session.date === todayKey && session.status !== "complete",
  );
  const upcomingAssignments = assignments
    .filter((assignment) => assignment.dueDate >= todayKey && assignment.status !== "complete")
    .slice(0, 5)
    .map((assignment) => ({
      ...assignment,
      dueLabel: formatDueLabel(assignment.dueDate, today),
    }));
  const workload = Array.from({ length: 7 }, (_, index) => {
    const date = dateKey(addDays(today, index));
    const daySessions = sessions.filter((session) => session.date === date && session.status !== "complete");
    return {
      date,
      dayLabel: index === 0
        ? "Today"
        : addDays(today, index).toLocaleDateString("en-US", { weekday: "short" }),
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
    greeting: "Good afternoon",
    dateLabel: today.toLocaleDateString("en-US", {
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

router.get("/planner/dashboard", async (_req, res, next) => {
  try {
    res.json(await buildDashboard());
  } catch (error) {
    next(error);
  }
});

router.post("/planner/plans", async (req, res, next) => {
  try {
    const input = CreateStudyPlanBody.parse(req.body);
    const today = startOfDay();
    const parsed = parseAssignments(input.note, today);
    const availableMinutes = input.availableMinutesPerDay ?? 90;
    const assignments = [];
    const tasks = [];
    const sessions = [];
    const dayUsage = new Map<string, number>();
    let sessionNumber = 0;

    for (const [assignmentIndex, item] of parsed.entries()) {
      const blueprint = taskBlueprint(item.kind);
      const totalMinutes = blueprint.reduce((sum, [, minutes]) => sum + minutes, 0);
      const [assignment] = await db
        .insert(assignmentsTable)
        .values({
          title: item.title,
          subject: item.subject,
          dueDate: item.dueDate,
          dueLabel: item.dueLabel,
          totalMinutes,
          completedMinutes: 0,
          status: "on_track",
          accent: ACCENTS[assignmentIndex % ACCENTS.length],
        })
        .returning();
      assignments.push({
        ...assignment,
        dueLabel: formatDueLabel(assignment.dueDate, today),
      });

      for (const [taskIndex, [taskTitle, durationMinutes]] of blueprint.entries()) {
        const [task] = await db
          .insert(studyTasksTable)
          .values({
            assignmentId: assignment.id,
            title: taskTitle,
            durationMinutes,
            status: "todo",
            sortOrder: taskIndex,
          })
          .returning();
        tasks.push(task);

        let candidateDate = new Date(`${dateKey(today)}T12:00:00`);
        const due = new Date(`${item.dueDate}T12:00:00`);
        while (
          candidateDate < due &&
          (dayUsage.get(dateKey(candidateDate)) ?? 0) + durationMinutes > availableMinutes
        ) {
          candidateDate = addDays(candidateDate, 1);
        }
        if (candidateDate > due) candidateDate = due;
        const scheduledDate = dateKey(candidateDate);
        dayUsage.set(scheduledDate, (dayUsage.get(scheduledDate) ?? 0) + durationMinutes);
        const startTime = startTimeFor(candidateDate, sessionNumber % 3);
        sessionNumber += 1;
        const [session] = await db
          .insert(studySessionsTable)
          .values({
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
          isToday: scheduledDate === dateKey(today),
        });
      }
    }

    res.status(201).json(
      CreateStudyPlanResponse.parse({
        assignments,
        tasks,
        sessions,
        summary: `I mapped ${tasks.length} small steps across ${dayUsage.size} study days, keeping each day under ${availableMinutes} minutes.`,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.patch("/planner/tasks/:id", async (req, res, next) => {
  try {
    const { id } = UpdatePlannerTaskParams.parse(req.params);
    const { status } = UpdatePlannerTaskBody.parse(req.body);
    const [task] = await db
      .update(studyTasksTable)
      .set({ status })
      .where(eq(studyTasksTable.id, id))
      .returning();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await updateAssignmentProgress(task.assignmentId);
    if (status === "done") {
      await db
        .update(studySessionsTable)
        .set({ status: "complete" })
        .where(eq(studySessionsTable.taskId, id));
    }
    res.json(UpdatePlannerTaskResponse.parse(task));
  } catch (error) {
    next(error);
  }
});

router.post("/planner/sessions/:id/complete", async (req, res, next) => {
  try {
    const { id } = CompleteStudySessionParams.parse(req.params);
    const [session] = await db
      .update(studySessionsTable)
      .set({ status: "complete" })
      .where(eq(studySessionsTable.id, id))
      .returning();
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await db
      .update(studyTasksTable)
      .set({ status: "done" })
      .where(eq(studyTasksTable.id, session.taskId));
    await updateAssignmentProgress(session.assignmentId);
    const [view] = (await getSessionRows())
      .filter((row) => row.id === id)
      .map((row) => sessionView(row, dateKey(startOfDay())));
    res.json(CompleteStudySessionResponse.parse(view));
  } catch (error) {
    next(error);
  }
});

router.post("/planner/sessions/:id/reschedule", async (req, res, next) => {
  try {
    const { id } = RescheduleStudySessionParams.parse(req.params);
    const { date } = RescheduleStudySessionBody.parse(req.body);
    const dateValue = dateKey(date);
    const [session] = await db
      .update(studySessionsTable)
      .set({ date: dateValue, status: "scheduled" })
      .where(eq(studySessionsTable.id, id))
      .returning();
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const [view] = (await getSessionRows())
      .filter((row) => row.id === id)
      .map((row) => sessionView(row, dateKey(startOfDay())));
    res.json(RescheduleStudySessionResponse.parse(view));
  } catch (error) {
    next(error);
  }
});

export default router;