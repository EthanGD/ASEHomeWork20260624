import jwt from "jsonwebtoken";
import { signToken } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";

export type WechatFlowState =
  | {
      action: "login";
    }
  | {
      action: "bind";
      userId: number;
    };

export const buildWechatRedirect = (token?: string, error?: string) => {
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

export const buildWechatBindRedirect = (success: boolean, message?: string) => {
  const url = new URL(config.clientUrl);
  url.searchParams.set("account", "wechat");
  url.searchParams.set("bind", success ? "success" : "error");
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
};

export const signWechatState = (payload: WechatFlowState) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: "10m" });

export const parseWechatState = (state?: string | null): WechatFlowState | null => {
  if (!state) {
    return null;
  }

  try {
    return jwt.verify(state, config.jwtSecret) as WechatFlowState;
  } catch {
    return null;
  }
};

export const buildWechatAuthUrl = (state: string) => {
  if (!config.wechat.appId || !config.wechat.appSecret) {
    return {
      mode: "mock" as const,
      url: `${config.serverPublicUrl}/api/auth/wechat/mock-callback?state=${encodeURIComponent(state)}`
    };
  }

  const redirectUri = encodeURIComponent(config.wechat.redirectUri);
  return {
    mode: "real" as const,
    url:
      `https://open.weixin.qq.com/connect/qrconnect?appid=${config.wechat.appId}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
  };
};

export const getMockWechatProfile = (state: WechatFlowState | null) => {
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

export const createWechatUserAndRedirect = async ({
  openId,
  nickname,
  email
}: {
  openId: string;
  nickname: string;
  email?: string;
}) => {
  const existing = await query<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE wechat_open_id = $1 AND deleted = FALSE
      LIMIT 1
    `,
    [openId]
  );

  let userId = existing.rows[0]?.id;

  if (!userId) {
    const inserted = await query<{ id: number }>(
      `
        INSERT INTO users(username, password_hash, display_name, email, auth_source, wechat_open_id)
        VALUES ($1, NULL, $2, $3, 'wechat', $4)
        RETURNING id
      `,
      [`wx_${openId.slice(0, 12)}`, nickname, email ?? null, openId]
    );
    userId = inserted.rows[0].id;

    const employeeRole = await query<{ id: number }>(
      `SELECT id FROM roles WHERE name = '普通员工' LIMIT 1`
    );
    if (employeeRole.rows[0]) {
      await query(
        `
          INSERT INTO user_roles(user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [userId, employeeRole.rows[0].id]
      );
    }
  }

  const token = signToken(userId);
  return buildWechatRedirect(token);
};

export const bindWechatToUser = async ({
  userId,
  openId
}: {
  userId: number;
  openId: string;
}) => {
  const target = await query<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE id = $1 AND deleted = FALSE
      LIMIT 1
    `,
    [userId]
  );

  if (!target.rows[0]) {
    throw new Error("当前账号不存在或已删除");
  }

  const existing = await query<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE wechat_open_id = $1 AND deleted = FALSE
      LIMIT 1
    `,
    [openId]
  );

  if (existing.rows[0] && existing.rows[0].id !== userId) {
    throw new Error("该微信号已绑定其他账号");
  }

  await query(
    `
      UPDATE users
      SET wechat_open_id = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [userId, openId]
  );
};
