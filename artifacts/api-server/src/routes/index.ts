import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reviewsRouter from "./reviews";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import calendarRouter from "./calendar";
import sharedRouter from "./shared";
import plannerRouter from "./planner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarRouter);
router.use(sharedRouter);
router.use(authRouter);
router.use(reviewsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(plannerRouter);

export default router;
