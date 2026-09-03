import type { RequestHandler } from "express";
import { resolveSession } from "../lib/auth/tokens.js";
import { findUserById } from "../lib/auth/users.js";

const BEARER = /^Bearer\s+(.+)$/i;

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = BEARER.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Gate for every authenticated route. Reads `Authorization: Bearer <token>`,
 * resolves it to a user, and sets `req.userId`. Responds 401 otherwise — the
 * body shape matches the OpenAPI `ErrorResponse`.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = bearerToken(req.get("authorization"));
    const userId = token ? await resolveSession(token) : null;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
};

/** Narrow `req.userId` to a number inside a handler that runs after requireAuth. */
export function currentUserId(req: { userId?: number }): number {
  if (typeof req.userId !== "number") {
    throw new Error("currentUserId called on an unauthenticated request");
  }
  return req.userId;
}

/**
 * Gate for admin-only routes. Runs after `requireAuth`; loads the user and
 * checks `role === "admin"`. Responds 403 for a signed-in non-admin.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const user = req.userId ? await findUserById(req.userId) : undefined;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
