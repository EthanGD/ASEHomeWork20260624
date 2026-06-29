import { Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
import {
  buildGithubAuthUrl,
  fetchUserIdentities,
  signGithubState,
  unbindGithubFromUser
} from "../services/github.js";
import {
  buildWechatAuthUrl,
  signWechatState
} from "../services/wechat.js";
import {
  createPasskeyRegisterOptions,
  verifyAndBindPasskey,
  listPasskeys,
  deletePasskey
} from "../services/passkey.js";
import { sendError } from "../utils/http.js";

const resolveRequestOrigin = (request: AuthenticatedRequest) => {
  const forwardedOrigin = request.headers["x-forwarded-origin"];
  if (typeof forwardedOrigin === "string") {
    return forwardedOrigin;
  }
  if (Array.isArray(forwardedOrigin) && forwardedOrigin[0]) {
    return forwardedOrigin[0];
  }
  const origin = request.headers.origin;
  if (typeof origin === "string") {
    return origin;
  }
  if (Array.isArray(origin) && origin[0]) {
    return origin[0];
  }
  return undefined;
};

export const createAccountRouter = () => {
  const router = Router();

  router.get("/", requireAuth, async (request: AuthenticatedRequest, response) => {
    response.json({ user: request.user });
  });

  router.get("/identities", requireAuth, async (request: AuthenticatedRequest, response) => {
    const user = request.user!;
    response.json({ identities: await fetchUserIdentities(user.id) });
  });

  router.get("/wechat/bind/url", requireAuth, async (request: AuthenticatedRequest, response) => {
    const user = request.user!;
    const state = signWechatState({ action: "bind", userId: user.id });
    response.json(buildWechatAuthUrl(state));
  });

  router.post("/wechat/unbind", requireAuth, async (request: AuthenticatedRequest, response) => {
    const user = request.user!;
    const result = await query<{ password_hash: string | null }>(
      `
        SELECT password_hash
        FROM users
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `,
      [user.id]
    );

    if (!result.rows[0]) {
      sendError(response, 404, "当前账号不存在");
      return;
    }

    if (!result.rows[0].password_hash) {
      sendError(response, 400, "当前账号未设置密码，不能解除微信绑定");
      return;
    }

    await query(
      `
        UPDATE users
        SET wechat_open_id = NULL, updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    );

    response.json({ success: true });
  });

  router.get("/github/bind/url", requireAuth, async (request: AuthenticatedRequest, response) => {
    if (!config.github.clientId || !config.github.clientSecret) {
      sendError(
        response,
        400,
        "GitHub 配置缺失：请在 server/.env 设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 后重启后端"
      );
      return;
    }

    const user = request.user!;
    const state = signGithubState({ provider: "github", action: "bind", userId: user.id });
    response.json(buildGithubAuthUrl(state));
  });

  router.post("/github/unbind", requireAuth, async (request: AuthenticatedRequest, response) => {
    const user = request.user!;
    const result = await query<{ password_hash: string | null }>(
      `
        SELECT password_hash
        FROM users
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `,
      [user.id]
    );

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

  router.post(
    "/passkey/register/options",
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const user = request.user!;
      response.json(await createPasskeyRegisterOptions(user.id, user.username, resolveRequestOrigin(request)));
    }
  );

  router.post(
    "/passkey/register/verify",
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const user = request.user!;
      try {
        const result = await verifyAndBindPasskey(user.id, (request.body as { credential?: unknown }).credential);
        response.json({ success: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "绑定指纹登录失败";
        sendError(response, 400, message);
      }
    }
  );

  router.get(
    "/passkey/list",
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const user = request.user!;
      const passkeys = await listPasskeys(user.id);
      response.json({ passkeys });
    }
  );

  router.delete(
    "/passkey/:credentialId",
    requireAuth,
    async (request: AuthenticatedRequest, response) => {
      const user = request.user!;
      const credentialParam = request.params.credentialId;
      const credentialId = Array.isArray(credentialParam) ? credentialParam[0] : credentialParam;
      if (!credentialId) {
        sendError(response, 400, "credentialId 缺失");
        return;
      }
      const deleted = await deletePasskey(user.id, credentialId);
      if (!deleted) {
        sendError(response, 404, "指纹凭证不存在");
        return;
      }
      response.json({ success: true });
    }
  );

  return router;
};
