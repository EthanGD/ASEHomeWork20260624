import jwt from "jsonwebtoken";
import { signToken } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
export const buildWechatRedirect = (token, error) => {
    const url = new URL(config.clientUrl);
    if (token) {
        url.searchParams.set("token", token);
    }
    url.searchParams.set("auth", "wechat");
    if (error) {
        url.searchParams.set("error", error);
    }
    return url.toString();
};
export const buildWechatBindRedirect = (success, message) => {
    const url = new URL(config.clientUrl);
    url.searchParams.set("account", "wechat");
    url.searchParams.set("bind", success ? "success" : "error");
    if (message) {
        url.searchParams.set("message", message);
    }
    return url.toString();
};
export const signWechatState = (payload) => jwt.sign(payload, config.jwtSecret, { expiresIn: "10m" });
export const parseWechatState = (state) => {
    if (!state) {
        return null;
    }
    try {
        return jwt.verify(state, config.jwtSecret);
    }
    catch {
        return null;
    }
};
export const buildWechatAuthUrl = (state) => {
    if (!config.wechat.appId || !config.wechat.appSecret) {
        return {
            mode: "mock",
            url: `${config.serverPublicUrl}/api/auth/wechat/mock-callback?state=${encodeURIComponent(state)}`
        };
    }
    const redirectUri = encodeURIComponent(config.wechat.redirectUri);
    return {
        mode: "real",
        url: `https://open.weixin.qq.com/connect/qrconnect?appid=${config.wechat.appId}` +
            `&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
    };
};
export const getMockWechatProfile = (state) => {
    if (state?.action === "bind") {
        return {
            openId: `${config.wechat.mock.openId}-bind-${state.userId}`,
            nickname: `${config.wechat.mock.nickname}${state.userId}`,
            email: config.wechat.mock.email
        };
    }
    return {
        openId: config.wechat.mock.openId,
        nickname: config.wechat.mock.nickname,
        email: config.wechat.mock.email
    };
};
export const createWechatUserAndRedirect = async ({ openId, nickname, email }) => {
    const existing = await query(`
      SELECT id
      FROM users
      WHERE wechat_open_id = $1 AND deleted = FALSE
      LIMIT 1
    `, [openId]);
    let userId = existing.rows[0]?.id;
    if (!userId) {
        const inserted = await query(`
        INSERT INTO users(username, password_hash, display_name, email, auth_source, wechat_open_id)
        VALUES ($1, NULL, $2, $3, 'wechat', $4)
        RETURNING id
      `, [`wx_${openId.slice(0, 12)}`, nickname, email ?? null, openId]);
        userId = inserted.rows[0].id;
        const employeeRole = await query(`SELECT id FROM roles WHERE name = '普通员工' LIMIT 1`);
        if (employeeRole.rows[0]) {
            await query(`
          INSERT INTO user_roles(user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [userId, employeeRole.rows[0].id]);
        }
    }
    const token = signToken(userId);
    return buildWechatRedirect(token);
};
export const bindWechatToUser = async ({ userId, openId }) => {
    const target = await query(`
      SELECT id
      FROM users
      WHERE id = $1 AND deleted = FALSE
      LIMIT 1
    `, [userId]);
    if (!target.rows[0]) {
        throw new Error("当前账号不存在或已删除");
    }
    const existing = await query(`
      SELECT id
      FROM users
      WHERE wechat_open_id = $1 AND deleted = FALSE
      LIMIT 1
    `, [openId]);
    if (existing.rows[0] && existing.rows[0].id !== userId) {
        throw new Error("该微信号已绑定其他账号");
    }
    await query(`
      UPDATE users
      SET wechat_open_id = $2, updated_at = NOW()
      WHERE id = $1
    `, [userId, openId]);
};
