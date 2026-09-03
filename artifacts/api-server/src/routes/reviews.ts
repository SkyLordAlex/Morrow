import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  ListReviewsResponse,
  UpsertMyReviewBody,
  UpsertMyReviewResponse,
} from "@workspace/api-zod";
import { db, reviewsTable, usersTable } from "@workspace/db";
import {
  currentUserId,
  requireAdmin,
  requireAuth,
} from "../middlewares/require-auth.js";

const router: IRouter = Router();

// Per-route middleware, not `router.use(...)`: this router is mounted at "/"
// (alongside auth/admin/planner), so a router-level gate would also fire on
// every route registered after it.

type ReviewRow = {
  id: number;
  userId: number;
  rating: number;
  body: string | null;
  createdAt: Date;
  authorName: string | null;
};

function toView(row: ReviewRow, viewerId: number) {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body ?? null,
    authorName: row.authorName ?? null,
    createdAt: row.createdAt.toISOString(),
    mine: row.userId === viewerId,
  };
}

router.get("/reviews", requireAuth, async (req, res, next) => {
  try {
    const viewerId = currentUserId(req);
    const rows = await db
      .select({
        id: reviewsTable.id,
        userId: reviewsTable.userId,
        rating: reviewsTable.rating,
        body: reviewsTable.body,
        createdAt: reviewsTable.createdAt,
        authorName: usersTable.displayName,
      })
      .from(reviewsTable)
      .innerJoin(usersTable, eq(usersTable.id, reviewsTable.userId))
      .orderBy(desc(reviewsTable.updatedAt));

    const reviews = rows.map((row) => toView(row, viewerId));
    const count = reviews.length;
    const average = count
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / count) *
            10,
        ) / 10
      : 0;
    const myReview = reviews.find((review) => review.mine) ?? null;

    res.json(ListReviewsResponse.parse({ average, count, reviews, myReview }));
  } catch (error) {
    next(error);
  }
});

router.put("/reviews/me", requireAuth, async (req, res, next) => {
  try {
    const viewerId = currentUserId(req);
    const input = UpsertMyReviewBody.parse(req.body);
    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be between 1 and 5." });
      return;
    }
    const body = input.body?.trim() ? input.body.trim().slice(0, 2000) : null;

    const [row] = await db
      .insert(reviewsTable)
      .values({ userId: viewerId, rating, body })
      .onConflictDoUpdate({
        target: reviewsTable.userId,
        set: { rating, body, updatedAt: new Date() },
      })
      .returning();

    const [user] = await db
      .select({ displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, viewerId));

    res.json(
      UpsertMyReviewResponse.parse(
        toView({ ...row, authorName: user?.displayName ?? null }, viewerId),
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Choose a rating from 1 to 5." });
      return;
    }
    next(error);
  }
});

router.delete("/reviews/me", requireAuth, async (req, res, next) => {
  try {
    await db
      .delete(reviewsTable)
      .where(eq(reviewsTable.userId, currentUserId(req)));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Admin moderation: remove anyone's review by its id. Registered after
// "/reviews/me" so "me" never falls through to the :id param.
router.delete(
  "/reviews/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Invalid review id" });
        return;
      }
      const [removed] = await db
        .delete(reviewsTable)
        .where(eq(reviewsTable.id, id))
        .returning();
      if (!removed) {
        res.status(404).json({ error: "Review not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
