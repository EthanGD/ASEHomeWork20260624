import { Router } from "express";
import { hashPassword, requireAuth, requirePermission } from "../auth.js";
import { query } from "../db.js";
import { fetchUsers } from "../services/users.js";
import { sendError } from "../utils/http.js";
export const createUsersRouter = () => {
    const router = Router();
    router.get("/", requireAuth, requirePermission("user:manage"), async (_request, response) => {
        response.json(await fetchUsers());
    });
    router.post("/", requireAuth, requirePermission("user:manage"), async (request, response) => {
        const { username, password, displayName, email, status, roleIds } = request.body;
        if (!username?.trim() || !password?.trim() || !displayName?.trim() || !roleIds?.length) {
            sendError(response, 400, "请填写完整用户信息");
            return;
        }
        const duplicated = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username.trim()]);
        if (duplicated.rows[0]) {
            sendError(response, 400, "账号已存在");
            return;
        }
        const passwordHash = await hashPassword(password.trim());
        const inserted = await query(`
        INSERT INTO users(username, password_hash, display_name, email, status, auth_source)
        VALUES ($1, $2, $3, $4, $5, 'local')
        RETURNING id
      `, [username.trim(), passwordHash, displayName.trim(), email?.trim() ?? null, status ?? "enabled"]);
        await query(`DELETE FROM user_roles WHERE user_id = $1`, [inserted.rows[0].id]);
        for (const roleId of roleIds) {
            await query(`
          INSERT INTO user_roles(user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [inserted.rows[0].id, roleId]);
        }
        response.status(201).json({ success: true });
    });
    router.put("/:id", requireAuth, requirePermission("user:manage"), async (request, response) => {
        const userId = Number(request.params.id);
        const operator = request.user;
        const { username, password, displayName, email, status, roleIds } = request.body;
        if (operator.id === userId && status === "disabled") {
            sendError(response, 400, "不能禁用当前登录用户");
            return;
        }
        const target = await query(`SELECT auth_source FROM users WHERE id = $1 AND deleted = FALSE LIMIT 1`, [userId]);
        if (!target.rows[0]) {
            sendError(response, 404, "用户不存在");
            return;
        }
        await query(`
          UPDATE users
          SET
            username = $2,
            display_name = $3,
            email = $4,
            status = $5,
            updated_at = NOW()
          WHERE id = $1
        `, [userId, username?.trim() ?? null, displayName?.trim() ?? "", email?.trim() ?? null, status ?? "enabled"]);
        if (password?.trim() && target.rows[0].auth_source === "local") {
            const passwordHash = await hashPassword(password.trim());
            await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
                userId,
                passwordHash
            ]);
        }
        await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
        for (const roleId of roleIds ?? []) {
            await query(`
            INSERT INTO user_roles(user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [userId, roleId]);
        }
        response.json({ success: true });
    });
    router.delete("/:id", requireAuth, requirePermission("user:manage"), async (request, response) => {
        const userId = Number(request.params.id);
        if (request.user.id === userId) {
            sendError(response, 400, "不能删除当前登录用户");
            return;
        }
        await query(`UPDATE users SET deleted = TRUE, updated_at = NOW() WHERE id = $1`, [userId]);
        response.json({ success: true });
    });
    return router;
};
