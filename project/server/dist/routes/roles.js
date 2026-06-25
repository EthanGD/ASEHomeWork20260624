import { Router } from "express";
import { requireAuth, requirePermission } from "../auth.js";
import { query } from "../db.js";
import { fetchRoles } from "../services/roles.js";
import { sendError } from "../utils/http.js";
export const createRolesRouter = () => {
    const router = Router();
    router.get("/", requireAuth, async (_request, response) => {
        response.json(await fetchRoles());
    });
    router.post("/", requireAuth, requirePermission("role:manage"), async (request, response) => {
        const { name, description, permissions } = request.body;
        if (!name?.trim() || !permissions?.length) {
            sendError(response, 400, "请填写角色名称和权限");
            return;
        }
        await query(`
        INSERT INTO roles(name, description, permission_keys, is_system)
        VALUES ($1, $2, $3::text[], FALSE)
      `, [name.trim(), description?.trim() ?? "", permissions]);
        response.status(201).json({ success: true });
    });
    router.put("/:id", requireAuth, requirePermission("role:manage"), async (request, response) => {
        const roleId = Number(request.params.id);
        const { name, description, permissions } = request.body;
        if (!name?.trim() || !permissions?.length) {
            sendError(response, 400, "请填写角色名称和权限");
            return;
        }
        await query(`
        UPDATE roles
        SET name = $2, description = $3, permission_keys = $4::text[]
        WHERE id = $1
      `, [roleId, name.trim(), description?.trim() ?? "", permissions]);
        response.json({ success: true });
    });
    router.patch("/:id/disabled", requireAuth, requirePermission("role:manage"), async (request, response) => {
        const roleId = Number(request.params.id);
        const { disabled } = request.body;
        await query(`UPDATE roles SET disabled = $2 WHERE id = $1`, [roleId, Boolean(disabled)]);
        response.json({ success: true });
    });
    router.delete("/:id", requireAuth, requirePermission("role:manage"), async (request, response) => {
        const roleId = Number(request.params.id);
        const role = await query(`SELECT is_system FROM roles WHERE id = $1 LIMIT 1`, [roleId]);
        if (!role.rows[0]) {
            sendError(response, 404, "角色不存在");
            return;
        }
        if (role.rows[0].is_system) {
            sendError(response, 400, "系统默认角色不可删除");
            return;
        }
        await query(`DELETE FROM roles WHERE id = $1`, [roleId]);
        response.json({ success: true });
    });
    return router;
};
