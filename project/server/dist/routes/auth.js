import { Router } from "express";
import { comparePassword, fetchSessionUser, requireAuth, signToken } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { dbgWrite } from "../services/debug.js";
import { bindGithubToUser, buildGithubBindRedirect, buildGithubAuthUrl, buildGithubLoginRedirect, exchangeGithubCode, fetchGithubIdentityUserId, fetchGithubUser, getMockGithubProfile, parseGithubState, signGithubState } from "../services/github.js";
import { createPasskeyLoginOptions, verifyPasskeyLogin } from "../services/passkey.js";
import { bindWechatToUser, buildWechatAuthUrl, buildWechatBindRedirect, buildWechatRedirect, createWechatUserAndRedirect, getMockWechatProfile, parseWechatState, signWechatState } from "../services/wechat.js";
import { sanitizeUser, sendError } from "../utils/http.js";
const resolveRequestOrigin = (request) => {
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
export const createAuthRouter = () => {
    const router = Router();
    router.post("/login", async (request, response) => {
        const { username, password } = request.body;
        if (!username || !password) {
            void dbgWrite({ side: "server", kind: "auth", action: "login", result: "missing_fields" });
            sendError(response, 400, "请输入账号和密码");
            return;
        }
        const result = await query(`
        SELECT id, password_hash, status, deleted
        FROM users
        WHERE username = $1
        LIMIT 1
      `, [username]);
        const row = result.rows[0];
        if (!row || row.deleted || row.status !== "enabled" || !row.password_hash) {
            void dbgWrite({
                side: "server",
                kind: "auth",
                action: "login",
                result: "user_unavailable",
                username
            });
            sendError(response, 401, "账号不存在、已禁用或不支持密码登录");
            return;
        }
        const matched = await comparePassword(password, row.password_hash);
        if (!matched) {
            void dbgWrite({
                side: "server",
                kind: "auth",
                action: "login",
                result: "bad_password",
                username
            });
            sendError(response, 401, "账号或密码错误");
            return;
        }
        const sessionUser = await fetchSessionUser(row.id);
        if (!sessionUser) {
            void dbgWrite({
                side: "server",
                kind: "auth",
                action: "login",
                result: "session_user_null",
                userId: row.id
            });
            sendError(response, 401, "用户不可用");
            return;
        }
        void dbgWrite({
            side: "server",
            kind: "auth",
            action: "login",
            result: "success",
            userId: row.id,
            username
        });
        response.json(sanitizeUser(sessionUser, signToken(row.id)));
    });
    router.get("/me", requireAuth, async (request, response) => {
        response.json({ user: request.user });
    });
    router.post("/passkey/options", async (request, response) => {
        response.json(await createPasskeyLoginOptions(resolveRequestOrigin(request)));
    });
    /*
    Account info: The credential.id (9pX_Z8NyqfRBxB7RLIWe6Q) IS the account identifier. The server looks up this ID in the webauthn_credentials table, which is bound to user_id=1. You don't need to send the username — the credential ID is a unique key that maps to the user.
  
  Device info: The authenticatorData contains the RP ID hash and flags (user presence, user verification). The server validates the RP ID matches the expected domain — this implicitly verifies the device.
  
  Why verification was failing: The authenticator returns the signature in DER format (ASN.1 SEQUENCE wrapping, ~70 bytes), but crypto.subtle.verify expects raw format (r||s concatenated, exactly 64 bytes). I added a derToRaw() function to convert it. This is the root cause.
  
  账户信息：credential.id（9pX_Z8NyqfRBxB7RLIWe6Q）是账户标识符。服务器会在绑定至 user_id =1的 webauthn_credentials 表中查询该ID。无需发送用户名——凭证ID是唯一可映射到用户的标识键。设备信息：authenticatorData包含RP ID哈希值及标志位（用户在线状态、用户验证状态）。服务器会验证RP ID是否与预期域名匹配，从而隐式确认设备身份。验证失败原因：认证器返回DER格式的签名（采用 ASN .1序列封装方式，约70字节），而crypto.subtle_verify要求原始格式（字符串拼接结果，精确64字节）。我添加了derToRaw()函数进行转换，这正是根本原因。
    */
    router.post("/passkey/verify", async (request, response) => {
        try {
            const { userId } = await verifyPasskeyLogin(request.body.credential);
            const sessionUser = await fetchSessionUser(userId);
            if (!sessionUser) {
                sendError(response, 401, "用户不存在或已被禁用");
                return;
            }
            response.json(sanitizeUser(sessionUser, signToken(userId)));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "指纹登录失败";
            sendError(response, 400, message);
        }
    });
    router.get("/wechat/url", async (_request, response) => {
        const state = signWechatState({ action: "login" });
        const result = buildWechatAuthUrl(state);
        response.json(result);
        void dbgWrite({ side: "server", kind: "auth", action: "wechat_url", mode: result.mode });
    });
    router.get("/github/url", async (_request, response) => {
        if (!config.github.clientId || !config.github.clientSecret) {
            sendError(response, 400, "GitHub 配置缺失：请在 server/.env 设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 后重启后端");
            return;
        }
        const state = signGithubState({ provider: "github", action: "login" });
        const result = buildGithubAuthUrl(state);
        response.json(result);
        void dbgWrite({ side: "server", kind: "auth", action: "github_url", mode: result.mode });
    });
    router.get("/wechat/mock-callback", async (request, response) => {
        const state = parseWechatState(String(request.query.state ?? ""));
        const profile = getMockWechatProfile(state);
        if (state?.action === "bind") {
            try {
                await bindWechatToUser({ userId: state.userId, openId: profile.openId });
                response.redirect(buildWechatBindRedirect(true, "微信账号绑定成功"));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "微信账号绑定失败";
                response.redirect(buildWechatBindRedirect(false, message));
            }
            return;
        }
        const redirectUrl = await createWechatUserAndRedirect(profile);
        response.redirect(redirectUrl);
    });
    router.get("/wechat/callback", async (request, response) => {
        const code = String(request.query.code ?? "");
        const state = parseWechatState(String(request.query.state ?? ""));
        if (!code || !config.wechat.appId || !config.wechat.appSecret) {
            if (state?.action === "bind") {
                response.redirect(buildWechatBindRedirect(false, "微信配置缺失，请改用演示绑定入口"));
            }
            else {
                response.redirect(buildWechatRedirect(undefined, "微信配置缺失，请改用演示登录入口"));
            }
            return;
        }
        try {
            const tokenResponse = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&code=${code}&grant_type=authorization_code`);
            const tokenPayload = (await tokenResponse.json());
            if (!tokenPayload.access_token || !tokenPayload.openid) {
                throw new Error(tokenPayload.errmsg ?? "微信 access token 获取失败");
            }
            const userResponse = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${tokenPayload.access_token}&openid=${tokenPayload.openid}&lang=zh_CN`);
            const userPayload = (await userResponse.json());
            if (!userPayload.openid) {
                throw new Error(userPayload.errmsg ?? "微信用户信息获取失败");
            }
            const openId = userPayload.unionid ?? userPayload.openid;
            if (state?.action === "bind") {
                await bindWechatToUser({ userId: state.userId, openId });
                response.redirect(buildWechatBindRedirect(true, "微信账号绑定成功"));
                return;
            }
            const redirectUrl = await createWechatUserAndRedirect({
                openId,
                nickname: userPayload.nickname ?? "微信用户"
            });
            response.redirect(redirectUrl);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "微信登录失败";
            if (state?.action === "bind") {
                response.redirect(buildWechatBindRedirect(false, message));
            }
            else {
                response.redirect(buildWechatRedirect(undefined, message));
            }
        }
    });
    router.get("/github/mock-callback", async (request, response) => {
        const state = parseGithubState(String(request.query.state ?? ""));
        const profile = getMockGithubProfile(state);
        if (!state) {
            response.redirect(buildGithubBindRedirect(false, "GitHub state 无效或已过期"));
            return;
        }
        if (state.action === "bind") {
            try {
                await bindGithubToUser({
                    userId: state.userId,
                    githubId: profile.id,
                    githubLogin: profile.login,
                    githubEmail: profile.email
                });
                response.redirect(buildGithubBindRedirect(true, "GitHub 账号绑定成功"));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "GitHub 账号绑定失败";
                response.redirect(buildGithubBindRedirect(false, message));
            }
            return;
        }
        const userId = await fetchGithubIdentityUserId(profile.id);
        if (!userId) {
            response.redirect(buildGithubLoginRedirect(undefined, "该 GitHub 账号未绑定系统账号"));
            return;
        }
        response.redirect(buildGithubLoginRedirect(signToken(userId)));
    });
    router.get("/github/callback", async (request, response) => {
        const code = String(request.query.code ?? "");
        const state = parseGithubState(String(request.query.state ?? ""));
        if (!code) {
            if (state?.action === "login" || !state) {
                response.redirect(buildGithubLoginRedirect(undefined, "GitHub 回调缺少 code"));
            }
            else {
                response.redirect(buildGithubBindRedirect(false, "GitHub 回调缺少 code"));
            }
            return;
        }
        if (!config.github.clientId || !config.github.clientSecret) {
            const message = "GitHub 配置缺失：请在 server/.env 设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 后重启后端";
            if (state?.action === "login") {
                response.redirect(buildGithubLoginRedirect(undefined, message));
            }
            else {
                response.redirect(buildGithubBindRedirect(false, message));
            }
            return;
        }
        try {
            const accessToken = await exchangeGithubCode(code);
            const profile = await fetchGithubUser(accessToken);
            if (state?.action === "bind") {
                await bindGithubToUser({
                    userId: state.userId,
                    githubId: profile.id,
                    githubLogin: profile.login,
                    githubEmail: profile.email
                });
                response.redirect(buildGithubBindRedirect(true, "GitHub 账号绑定成功"));
                return;
            }
            const userId = await fetchGithubIdentityUserId(profile.id);
            if (!userId) {
                response.redirect(buildGithubLoginRedirect(undefined, "该 GitHub 账号未绑定系统账号，请先使用本地账号登录后在账号管理中绑定"));
                return;
            }
            response.redirect(buildGithubLoginRedirect(signToken(userId)));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "GitHub 账号绑定失败";
            if (state?.action === "login" || !state) {
                response.redirect(buildGithubLoginRedirect(undefined, message));
            }
            else {
                response.redirect(buildGithubBindRedirect(false, message));
            }
        }
    });
    return router;
};
