import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { createAccountRouter } from "./routes/account.js";
import { createAuthRouter } from "./routes/auth.js";
import { createRolesRouter } from "./routes/roles.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createSystemRouter } from "./routes/system.js";
import { createTasksRouter } from "./routes/tasks.js";
import { createTranscriptionsRouter } from "./routes/transcriptions.js";
import { createUsersRouter } from "./routes/users.js";
import { createDebugHttpLogger, createDebugRouter } from "./services/debug.js";
import { sendError } from "./utils/http.js";
const isCorsOriginAllowed = (origin) => {
    if (config.corsAllowedOrigins.includes(origin)) {
        return true;
    }
    return (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("http://192.168."));
};
export const createApp = () => {
    const app = express();
    app.use("/__dbg", createDebugRouter());
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || isCorsOriginAllowed(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error("Not allowed by CORS"));
        },
        credentials: false
    }));
    app.use(express.json({ limit: "4mb" }));
    app.use(createDebugHttpLogger());
    app.use("/api/account", createAccountRouter());
    app.use("/api/auth", createAuthRouter());
    app.use("/api/tasks", createTasksRouter());
    app.use("/api/users", createUsersRouter());
    app.use("/api/roles", createRolesRouter());
    app.use("/api/settings", createSettingsRouter());
    app.use("/api/transcriptions", createTranscriptionsRouter());
    app.use("/api", createSystemRouter());
    app.use((error, _request, response, _next) => {
        if (error instanceof jwt.JsonWebTokenError) {
            sendError(response, 401, "登录凭证无效");
            return;
        }
        console.error(error);
        sendError(response, 500, "服务器内部错误");
    });
    return app;
};
