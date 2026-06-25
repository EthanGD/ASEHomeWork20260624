import express, { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
const dbgFile = path.join(config.debug.dir, `trae-debug-log-${config.debug.sessionId}.ndjson`);
const debugHttpPrefixes = [
    "/api/auth",
    "/api/tasks",
    "/api/users",
    "/api/roles",
    "/api/settings"
];
export const dbgWrite = async (event) => {
    try {
        await fs.mkdir(config.debug.dir, { recursive: true });
        await fs.appendFile(dbgFile, `${JSON.stringify({
            ts: Date.now(),
            sessionId: config.debug.sessionId,
            ...event
        }, undefined, 0)}\n`, "utf8");
    }
    catch { }
};
export const createDebugRouter = () => {
    const router = Router();
    router.options("/event", (_request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.status(204).end();
    });
    router.post("/event", express.json({ limit: "256kb" }), async (request, response) => {
        const payload = request.body;
        response.setHeader("Access-Control-Allow-Origin", "*");
        await dbgWrite({ side: "client", kind: "event", payload });
        response.json({ ok: true });
    });
    return router;
};
export const createDebugHttpLogger = () => {
    return (request, response, next) => {
        const shouldLog = debugHttpPrefixes.some((prefix) => request.path.startsWith(prefix));
        if (!shouldLog) {
            next();
            return;
        }
        const startedAt = Date.now();
        response.on("finish", () => {
            void dbgWrite({
                side: "server",
                kind: "http",
                method: request.method,
                path: request.path,
                status: response.statusCode,
                durationMs: Date.now() - startedAt,
                origin: request.headers.origin ?? null,
                host: request.headers.host ?? null
            });
        });
        next();
    };
};
