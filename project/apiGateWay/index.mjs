import http from "node:http";

const PORT = Number(process.env.PORT || "3003");
const TARGET_BASE_URL = (process.env.TARGET_BASE_URL || "http://127.0.0.1:3002").trim();
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const json = (response, statusCode, payload) => {
  const body = Buffer.from(JSON.stringify(payload));
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", String(body.length));
  response.end(body);
};

const setCors = (request, response) => {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", origin || "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    request.headers["access-control-request-headers"] || "content-type, authorization"
  );
  response.setHeader("Access-Control-Max-Age", "86400");
};

const readJsonBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("请求体过大");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
};

const normalizeMethod = (method) => {
  const value = String(method || "").toUpperCase();
  const allowed = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
  if (!allowed.has(value)) {
    throw new Error("method 不合法");
  }
  return value;
};

const buildTargetUrl = (path, query) => {
  const base = new URL(TARGET_BASE_URL);
  const input = String(path || "");
  if (!input) {
    throw new Error("path 必填");
  }

  let url;
  if (/^https?:\/\//i.test(input)) {
    url = new URL(input);
    if (url.origin !== base.origin) {
      throw new Error("不允许转发到非目标后端地址");
    }
  } else {
    if (!input.startsWith("/")) {
      throw new Error("path 必须以 / 开头");
    }
    url = new URL(input, base);
  }

  const queryObj = query && typeof query === "object" ? query : {};
  for (const [k, v] of Object.entries(queryObj)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  return url;
};

const sanitizeForwardHeaders = (headers) => {
  const out = new Headers();
  if (!headers || typeof headers !== "object") {
    return out;
  }
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue;
    const key = String(k).toLowerCase();
    if (key === "host" || key === "content-length" || key === "connection") continue;
    out.set(key, String(v));
  }
  return out;
};

const server = http.createServer(async (request, response) => {
  setCors(request, response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, target: TARGET_BASE_URL });
    return;
  }

  if (url.pathname !== "/apiGateWay") {
    json(response, 404, { message: "not found" });
    return;
  }

  if (request.method !== "POST") {
    json(response, 405, { message: "method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const method = normalizeMethod(body.method);
    const targetUrl = buildTargetUrl(body.path, body.query);
    const forwardHeaders = sanitizeForwardHeaders(body.header);

    const hasPayload = body.payload !== undefined && body.payload !== null;
    let forwardBody;
    if (method !== "GET" && method !== "DELETE" && hasPayload) {
      if (typeof body.payload === "string") {
        forwardBody = body.payload;
      } else {
        forwardHeaders.set("content-type", forwardHeaders.get("content-type") || "application/json");
        forwardBody = JSON.stringify(body.payload);
      }
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: forwardBody
    });

    response.statusCode = upstream.status;
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      response.setHeader("Content-Type", contentType);
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Length", String(buf.length));
    response.end(buf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    json(response, 400, { message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`apiGateWay ready at http://localhost:${PORT}`);
  console.log(`apiGateWay target ${TARGET_BASE_URL}`);
});

