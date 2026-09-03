import { Router, type IRouter } from "express";
import { count, desc, eq, gte } from "drizzle-orm";
import {
  DeleteUserParams,
  GetAdminStatsResponse,
  ListAdminUsersResponse,
  SetUserRoleBody,
  SetUserRoleParams,
  SetUserRoleResponse,
} from "@workspace/api-zod";
import {
  assignmentsTable,
  db,
  reviewsTable,
  studySessionsTable,
  usersTable,
} from "@workspace/db";
import {
  currentUserId,
  requireAdmin,
  requireAuth,
} from "../middlewares/require-auth.js";

const router: IRouter = Router();

// `requireAuth, requireAdmin` per route, not `router.use(...)`: this router is
// mounted at "/" (alongside auth/reviews/planner), so a router-level gate would
// also fire on every route registered afterwards.

router.get(
  "/admin/stats",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const userRows = await db
        .select({ role: usersTable.role })
        .from(usersTable);
      const reviewRows = await db
        .select({ rating: reviewsTable.rating })
        .from(reviewsTable);
      const [assignments] = await db
        .select({ value: count() })
        .from(assignmentsTable);
      const [sessions] = await db
        .select({ value: count() })
        .from(studySessionsTable);
      const [recent] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(
          gte(
            usersTable.createdAt,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          ),
        );

      const reviewCount = reviewRows.length;
      const averageRating = reviewCount
        ? Math.round(
            (reviewRows.reduce((sum, row) => sum + row.rating, 0) /
              reviewCount) *
              10,
          ) / 10
        : 0;

      res.json(
        GetAdminStatsResponse.parse({
          userCount: userRows.length,
          adminCount: userRows.filter((row) => row.role === "admin").length,
          reviewCount,
          averageRating,
          assignmentCount: assignments?.value ?? 0,
          sessionCount: sessions?.value ?? 0,
          signupsLast7Days: recent?.value ?? 0,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt));

      const reviewCounts = await db
        .select({ userId: reviewsTable.userId, value: count() })
        .from(reviewsTable)
        .groupBy(reviewsTable.userId);
      const assignmentCounts = await db
        .select({ userId: assignmentsTable.userId, value: count() })
        .from(assignmentsTable)
        .groupBy(assignmentsTable.userId);

      const reviewByUser = new Map(
        reviewCounts.map((r) => [r.userId, r.value]),
      );
      const assignmentByUser = new Map(
        assignmentCounts.map((r) => [r.userId, r.value]),
      );

      res.json(
        ListAdminUsersResponse.parse({
          users: rows.map((row) => ({
            id: row.id,
            email: row.email,
            displayName: row.displayName ?? null,
            role: row.role === "admin" ? "admin" : "user",
            createdAt: row.createdAt.toISOString(),
            reviewCount: reviewByUser.get(row.id) ?? 0,
            assignmentCount: assignmentByUser.get(row.id) ?? 0,
          })),
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/admin/users/:id/role",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = SetUserRoleParams.parse(req.params);
      const { role } = SetUserRoleBody.parse(req.body);

      if (id === currentUserId(req)) {
        res
          .status(400)
          .json({ error: "You can't change your own role from here." });
        return;
      }

      const [updated] = await db
        .update(usersTable)
        .set({ role })
        .where(eq(usersTable.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(
        SetUserRoleResponse.parse({
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName ?? null,
          role: updated.role === "admin" ? "admin" : "user",
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Role must be 'user' or 'admin'." });
        return;
      }
      next(error);
    }
  },
);

router.delete(
  "/admin/users/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = DeleteUserParams.parse(req.params);

      if (id === currentUserId(req)) {
        res.status(400).json({
          error: "Delete your own account from the account menu instead.",
        });
        return;
      }

      // ON DELETE CASCADE clears the user's identities, sessions, reviews, and
      // every planner row.
      const [removed] = await db
        .delete(usersTable)
        .where(eq(usersTable.id, id))
        .returning({ id: usersTable.id });

      if (!removed) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid user id" });
        return;
      }
      next(error);
    }
  },
);

export default router;
