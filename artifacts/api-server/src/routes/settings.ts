import { Router, type IRouter } from "express";
import { GetSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";
import { getUserSettings, saveUserSettings } from "../lib/settings.js";
import { currentUserId, requireAuth } from "../middlewares/require-auth.js";

const router: IRouter = Router();

router.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const settings = await getUserSettings(currentUserId(req));
    res.json(GetSettingsResponse.parse(settings));
  } catch (error) {
    next(error);
  }
});

router.put("/settings", requireAuth, async (req, res, next) => {
  try {
    const input = UpdateSettingsBody.parse(req.body);
    const settings = await saveUserSettings(currentUserId(req), {
      defaultAvailableMinutes: input.defaultAvailableMinutes,
      blockedWeekdays: input.blockedWeekdays,
    });
    res.json(GetSettingsResponse.parse(settings));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Those settings don't look right." });
      return;
    }
    next(error);
  }
});

export default router;
