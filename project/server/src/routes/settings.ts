import { Router } from "express";
import { requireAuth, requirePermission } from "../auth.js";
import { AppSettings, normalizeSettings, saveSettings } from "../services/settings.js";

export const createSettingsRouter = () => {
  const router = Router();

  router.get("/", requireAuth, requirePermission("settings:manage"), async (_request, response) => {
    response.json(await normalizeSettings());
  });

  router.put("/", requireAuth, requirePermission("settings:manage"), async (request, response) => {
    const nextValue = request.body as AppSettings;
    await saveSettings(nextValue);
    response.json({ success: true });
  });

  return router;
};
