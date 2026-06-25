import { Router } from "express";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { buildGithubAuthUrl, fetchUserIdentities, signGithubState, unbindGithubFromUser } from "../services/github.js";
import { buildWechatAuthUrl, signWechatState } from "../services/wechat.js";
import { sendError } from "../utils/http.js";
export const createAccountRouter = () => {
    const router = Router();
    router.get("/", requireAuth, async (request, response) => {
        response.json({ user: request.user });
    });
    router.get("/identities", requireAuth, async (request, response) => {
        const user = request.user;
        response.json({ identities: await fetchUserIdentities(user.id) });
    });
    router.get("/wechat/bind/url", requireAuth, async (request, response) => {
        const user = request.user;
        const state = signWechatState({ action: "bind", userId: user.id });
        response.json(buildWechatAuthUrl(state));
    });
    router.post("/wechat/unbind", requireAuth, async (request, response) => {
        const user = request.user;
        const result = await query(`
        SELECT password_hash
        FROM users
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `, [user.id]);
        if (!result.rows[0]) {
            sendError(response, 404, "当前账号不存在");
            return;
        }
        if (!result.rows[0].password_hash) {
            sendError(response, 400, "当前账号未设置密码，不能解除微信绑定");
            return;
        }
        await query(`
        UPDATE users
        SET wechat_open_id = NULL, updated_at = NOW()
        WHERE id = $1
      `, [user.id]);
        response.json({ success: true });
    });
    router.get("/github/bind/url", requireAuth, async (request, response) => {
        if (!config.github.clientId || !config.github.clientSecret) {
            sendError(response, 400, "GitHub 配置缺失：请在 server/.env 设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 后重启后端");
            return;
        }
        const user = request.user;
        const state = signGithubState({ provider: "github", action: "bind", userId: user.id });
        response.json(buildGithubAuthUrl(state));
    });
    router.post("/github/unbind", requireAuth, async (request, response) => {
        const user = request.user;
        const result = await query(`
        SELECT password_hash
        FROM users
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `, [user.id]);
        if (!result.rows[0]) {
            sendError(response, 404, "当前账号不存在");
            return;
        }
        if (!result.rows[0].password_hash && !user.wechatBound) {
            sendError(response, 400, "当前账号未设置密码且未绑定微信，不能解除 GitHub 绑定");
            return;
        }
        await unbindGithubFromUser(user.id);
        response.json({ success: true });
    });
    return router;
};
