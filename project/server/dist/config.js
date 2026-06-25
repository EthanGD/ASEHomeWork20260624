import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ override: true });
const readNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const readCsv = (value, fallback) => {
    const items = value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [];
    return items.length ? items : fallback;
};
const port = readNumber(process.env.PORT, 3002);
const clientUrl = process.env.CLIENT_URL?.trim() || "http://localhost:5174";
const serverPublicUrl = process.env.SERVER_PUBLIC_URL?.trim() || `http://localhost:${port}`;
export const config = {
    port,
    clientUrl,
    serverPublicUrl,
    jwtSecret: process.env.JWT_SECRET?.trim() || "voice-task-secret",
    corsAllowedOrigins: readCsv(process.env.CORS_ALLOWED_ORIGINS, [clientUrl]),
    debug: {
        sessionId: process.env.DEBUG_SESSION_ID?.trim() || "server-local",
        dir: process.env.DEBUG_DIR?.trim() || path.resolve(process.cwd(), "..", ".dbg")
    },
    pg: {
        host: process.env.PGHOST?.trim() || "127.0.0.1",
        port: readNumber(process.env.PGPORT, 5433),
        user: process.env.PGUSER?.trim() || "postgres",
        password: process.env.PGPASSWORD ?? "123qwe",
        database: process.env.PGDATABASE?.trim() || "postgres"
    },
    wechat: {
        appId: process.env.WECHAT_APP_ID?.trim() || "",
        appSecret: process.env.WECHAT_APP_SECRET?.trim() || "",
        redirectUri: process.env.WECHAT_REDIRECT_URI?.trim() ||
            `${serverPublicUrl}/api/auth/wechat/callback`,
        mock: {
            openId: process.env.WECHAT_MOCK_OPEN_ID?.trim() || "mock-open-id",
            nickname: process.env.WECHAT_MOCK_NICKNAME?.trim() || "微信演示用户",
            email: process.env.WECHAT_MOCK_EMAIL?.trim() || "wechat.demo@example.com"
        }
    },
    github: {
        clientId: process.env.GITHUB_CLIENT_ID?.trim() || "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || "",
        redirectUri: process.env.GITHUB_REDIRECT_URI?.trim() ||
            `${serverPublicUrl}/api/auth/github/callback`,
        mock: {
            id: process.env.GITHUB_MOCK_ID?.trim() || "mock-github-id",
            login: process.env.GITHUB_MOCK_LOGIN?.trim() || "mock-github-user"
        }
    }
};
