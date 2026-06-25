import { Router } from "express";
import { requireAuth } from "../auth.js";
import { query } from "../db.js";
import { fetchVisibleTasks } from "../services/tasks.js";

export const createSystemRouter = () => {
  const router = Router();

  router.get("/health", async (_request, response) => {
    const dbResult = await query<{ ok: number }>(`SELECT 1 AS ok`);
    response.json({ ok: true, database: dbResult.rows[0].ok === 1 });
  });

  router.get("/dashboard", requireAuth, async (request, response) => {
    const tasks = await fetchVisibleTasks(request);
    response.json({
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      done: tasks.filter((task) => task.status === "done").length
    });
  });

  return router;
};
