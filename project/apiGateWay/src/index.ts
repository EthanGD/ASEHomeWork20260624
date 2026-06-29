import cors from "../../server/node_modules/cors/lib/index.js";
import express from "../../server/node_modules/express/index.js";

const port = Number(process.env.PORT || "3003");
const targetBaseUrl = (process.env.TARGET_BASE_URL || "http://127.0.0.1:3002").trim();
const maxBodyBytes = 2 * 1024 * 1024;

type GatewayBody = {
  path: string;
  method: string;
  payload?: unknown;
  header?: Record<string, string | number | boolean | null | undefined>;
  query?: Record<string, string | number | boolean | null | undefined>;
};

const normalizeMethod = (method: string) => {
  const value = String(method || "").toUpperCase();
  const allowed = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
  if (!allowed.has(value)) {
    throw new Error("method 不合法");
  }
  return value;
};

const buildTargetUrl = (pathValue: string, query: GatewayBody["query"]) => {
  const base = new URL(targetBaseUrl);
  const input = String(pathValue || "");
  if (!input) {
    throw new Error("path 必填");
  }

  let url: URL;
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

const sanitizeForwardHeaders = (header: GatewayBody["header"]) => {
  const headers = new Headers();
  if (!header || typeof header !== "object") {
    return headers;
  }

  for (const [k, v] of Object.entries(header)) {
    if (v === undefined || v === null) continue;
    const key = String(k).toLowerCase();
    if (key === "host" || key === "content-length" || key === "connection") continue;
    headers.set(key, String(v));
  }

  return headers;
};

const app = express();

app.use(
  cors({
    origin: (origin: any, callback: any) => callback(null, origin || "*"),
    credentials: false
  })
);

app.use(express.json({ limit: maxBodyBytes }));

app.get("/health", (_req: any, res: any) => {
  res.json({ ok: true, target: targetBaseUrl });
});

app.post("/apiGateWay", async (req: any, res: any) => {
  try {
    const body = req.body as GatewayBody;
    const method = normalizeMethod(body.method);
    const targetUrl = buildTargetUrl(body.path, body.query);
    const forwardHeaders = sanitizeForwardHeaders(body.header);

    const hasPayload = body.payload !== undefined && body.payload !== null;
    let forwardBody: string | undefined;
    if (method !== "GET" && method !== "DELETE" && hasPayload) {
      if (typeof body.payload === "string") {
        forwardBody = body.payload;
      } else {
        if (!forwardHeaders.get("content-type")) {
          forwardHeaders.set("content-type", "application/json");
        }
        forwardBody = JSON.stringify(body.payload);
      }
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: forwardBody
    });

    const contentType = upstream.headers.get("content-type");
    const buf = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status);
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    res.status(400).json({ message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`apiGateWay ready at http://localhost:${port}`);
  console.log(`apiGateWay target ${targetBaseUrl}`);
});
