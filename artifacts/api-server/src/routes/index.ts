import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reviewsRouter from "./reviews";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import plannerRouter from "./planner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(reviewsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(plannerRouter);

export default router;
