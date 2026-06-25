import { Router } from "express";
import { hasPermission, requireAuth } from "../auth.js";
import { query } from "../db.js";
import { fetchVisibleTasks } from "../services/tasks.js";
import { sendError } from "../utils/http.js";
export const createTasksRouter = () => {
    const router = Router();
    router.get("/", requireAuth, async (request, response) => {
        const tasks = await fetchVisibleTasks(request);
        response.json(tasks);
    });
    router.post("/", requireAuth, async (request, response) => {
        const user = request.user;
        if (!hasPermission(user, "task:manage_own") && !hasPermission(user, "task:edit_all")) {
            sendError(response, 403, "无权限创建事务");
            return;
        }
        const { title, content, status, priority, startAt, endAt } = request.body;
        if (!title?.trim()) {
            sendError(response, 400, "标题不能为空");
            return;
        }
        const result = await query(`
        INSERT INTO tasks(title, content, status, priority, start_at, end_at, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING id
      `, [
            title.trim(),
            content?.trim() ?? "",
            status ?? "todo",
            priority ?? "medium",
            startAt ?? null,
            endAt ?? null,
            user.id
        ]);
        response.status(201).json({ id: result.rows[0].id, success: true });
    });
    router.put("/:id", requireAuth, async (request, response) => {
        const user = request.user;
        const taskId = Number(request.params.id);
        const existing = await query(`SELECT created_by FROM tasks WHERE id = $1 LIMIT 1`, [taskId]);
        if (!existing.rows[0]) {
            sendError(response, 404, "事务不存在");
            return;
        }
        const canEdit = hasPermission(user, "task:edit_all") ||
            (hasPermission(user, "task:manage_own") && existing.rows[0].created_by === user.id);
        if (!canEdit) {
            sendError(response, 403, "无权限修改该事务");
            return;
        }
        const { title, content, status, priority, startAt, endAt } = request.body;
        await query(`
        UPDATE tasks
        SET
          title = $2,
          content = $3,
          status = $4,
          priority = $5,
          start_at = $6,
          end_at = $7,
          updated_by = $8,
          updated_at = NOW()
        WHERE id = $1
      `, [
            taskId,
            title?.trim() ?? "",
            content?.trim() ?? "",
            status ?? "todo",
            priority ?? "medium",
            startAt ?? null,
            endAt ?? null,
            user.id
        ]);
        response.json({ success: true });
    });
    router.delete("/:id", requireAuth, async (request, response) => {
        const user = request.user;
        const taskId = Number(request.params.id);
        const existing = await query(`SELECT created_by FROM tasks WHERE id = $1 LIMIT 1`, [taskId]);
        if (!existing.rows[0]) {
            sendError(response, 404, "事务不存在");
            return;
        }
        const canDelete = hasPermission(user, "task:edit_all") ||
            (hasPermission(user, "task:manage_own") && existing.rows[0].created_by === user.id);
        if (!canDelete) {
            sendError(response, 403, "无权限删除该事务");
            return;
        }
        await query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
        response.json({ success: true });
    });
    return router;
};
