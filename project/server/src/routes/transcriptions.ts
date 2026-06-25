import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { normalizeSettings } from "../services/settings.js";
import { sendError } from "../utils/http.js";

const upload = multer({ storage: multer.memoryStorage() });

export const createTranscriptionsRouter = () => {
  const router = Router();

  router.post("/", requireAuth, upload.single("file"), async (request, response) => {
    if (!request.file) {
      sendError(response, 400, "请上传音频文件");
      return;
    }

    const settings = await normalizeSettings();
    const integrations = settings.integrations;

    if (!integrations.funasrServiceUrl.trim()) {
      sendError(response, 400, "尚未配置 funASR 服务地址");
      return;
    }

    const targetUrl = `${integrations.funasrServiceUrl.replace(/\/$/, "")}${
      integrations.funasrApiPath.startsWith("/") ? integrations.funasrApiPath : `/${integrations.funasrApiPath}`
    }`;

    try {
      const form = new FormData();
      const fileBuffer = request.file.buffer;
      const fileArrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ) as ArrayBuffer;

      form.append(
        "file",
        new Blob([fileArrayBuffer], { type: request.file.mimetype }),
        request.file.originalname
      );

      const result = await fetch(targetUrl, {
        method: "POST",
        headers: integrations.funasrToken
          ? {
              Authorization: `Bearer ${integrations.funasrToken}`
            }
          : undefined,
        body: form
      });

      if (!result.ok) {
        throw new Error(`funASR 调用失败，状态码 ${result.status}`);
      }

      const payload = (await result.json()) as Record<string, unknown>;
      const text =
        payload.text ??
        payload.result ??
        payload.transcript ??
        ((payload.data as Record<string, unknown> | undefined)?.text ?? null) ??
        ((payload.data as Record<string, unknown> | undefined)?.result ?? null);

      if (typeof text !== "string" || !text.trim()) {
        throw new Error("funASR 未返回有效文本");
      }

      response.json({ text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "语音转写失败";
      sendError(response, 500, message);
    }
  });

  return router;
};
