import { Router, type IRouter, type Request } from "express";
import {
  GetSettingsResponse,
  SetCalendarFeedBody,
  UpdateSettingsBody,
} from "@workspace/api-zod";
import {
  getUserSettings,
  saveUserSettings,
  setCalendarFeed,
  type ResolvedSettings,
} from "../lib/settings.js";
import { currentUserId, requireAuth } from "../middlewares/require-auth.js";

const router: IRouter = Router();

/** The public origin this request came in on (honouring the Render proxy). */
function publicOrigin(req: Request): string {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}`;
}

function withUrl(settings: ResolvedSettings, req: Request) {
  return {
    ...settings,
    calendarUrl: settings.calendarToken
      ? `${publicOrigin(req)}/api/calendar/${settings.calendarToken}.ics`
      : null,
  };
}

router.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const settings = await getUserSettings(currentUserId(req));
    res.json(GetSettingsResponse.parse(withUrl(settings, req)));
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
      preferredTime: input.preferredTime,
    });
    res.json(GetSettingsResponse.parse(withUrl(settings, req)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Those settings don't look right." });
      return;
    }
    next(error);
  }
});

// Turn the calendar feed on/off. Passing `enabled: true` when it's already on
// rotates the token, invalidating the previous URL.
router.post("/settings/calendar-feed", requireAuth, async (req, res, next) => {
  try {
    const { enabled } = SetCalendarFeedBody.parse(req.body);
    await setCalendarFeed(currentUserId(req), enabled);
    const settings = await getUserSettings(currentUserId(req));
    res.json(GetSettingsResponse.parse(withUrl(settings, req)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Expected { enabled: boolean }." });
      return;
    }
    next(error);
  }
});

export default router;
