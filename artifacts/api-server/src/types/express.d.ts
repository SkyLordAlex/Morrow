// `requireAuth` populates `req.userId` after verifying the bearer token; every
// handler under the planner router can rely on it being a number.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export {};
