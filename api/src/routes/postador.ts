import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { gerarCaption as gerarCaptionIA, refazerCaption as refazerCaptionIA } from "../services/caption.js";
import { isCloudinaryConfigured, uploadBuffer } from "../services/cloudinary.js";
import { isMinioConfigured, uploadStream } from "../services/minio.js";
import { publishToInstagram } from "../services/instagram.js";
import { loadConfig } from "../store/config.js";
import { appendCronograma, listCronograma } from "../store/cronograma.js";

function extFromMimetype(mimetype: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
  };
  return map[mimetype.toLowerCase()] ?? ".bin";
}

/**
 * Postador: IA no backend, MinIO para mídia, Graph API para publicar, cronograma para histórico.
 */
export const postadorRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/postador/cronograma — lista de posts finalizados (para cronograma/histórico)
  fastify.get("/cronograma", async (_request, reply) => {
    const list = await listCronograma();
    return reply.send({ cronograma: list, total: list.length });
  });

  // POST /api/postador/gerar-caption — JSON { descricao, provider?, model? } OU multipart (descricao + arquivo + provider + model)
  fastify.post("/gerar-caption", async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    let descricao = "";
    let mediaType: "IMAGE" | "REELS" | undefined;
    let mediaUrl: string | undefined;
    let provider: string | undefined;
    let model: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "field") {
          const v = String(part.value ?? "").trim();
          if (part.fieldname === "descricao") descricao = v;
          else if (part.fieldname === "provider") provider = v;
          else if (part.fieldname === "model") model = v;
        }
        if (part.type === "file") {
          const mimetype = part.mimetype ?? "application/octet-stream";
          if (mimetype.startsWith("video/")) mediaType = "REELS";
          else if (mimetype.startsWith("image/")) mediaType = "IMAGE";
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);
          const ext = extFromMimetype(mimetype);
          if (isCloudinaryConfigured()) {
            mediaUrl = await uploadBuffer(buffer, mimetype, ext);
          } else if (isMinioConfigured()) {
            mediaUrl = await uploadStream(Readable.from(buffer), mimetype, ext);
          }
        }
      }
    } else {
      const body = request.body as { descricao?: string; provider?: string; model?: string };
      descricao = (body?.descricao ?? "").trim();
      provider = body?.provider?.trim();
      model = body?.model?.trim();
    }

    if (!descricao) {
      return reply.status(400).send({ error: "Campo 'descricao' é obrigatório" });
    }

    const providerNorm = provider === "claude" ? "claude" : undefined;
    try {
      const caption = await gerarCaptionIA(descricao, mediaType, {
        provider: providerNorm ?? (provider === "openai" ? "openai" : undefined),
        model: model || undefined,
      });
      return reply.send({
        caption,
        media_url: mediaUrl ?? undefined,
        media_type: mediaType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar caption";
      if (msg.includes("OPENAI_API_KEY") || msg.includes("ANTHROPIC_API_KEY")) {
        return reply.status(503).send({ error: msg });
      }
      if (msg.includes("MINIO") || msg.includes("CLOUDINARY")) {
        return reply.status(503).send({ error: msg });
      }
      fastify.log.error({ err }, "gerar-caption");
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /api/postador/refazer-caption — JSON: { caption_atual, feedback, provider?, model? }
  fastify.post("/refazer-caption", async (request, reply) => {
    const body = request.body as {
      caption_atual?: string;
      feedback?: string;
      provider?: string;
      model?: string;
    };
    const captionAtual = body?.caption_atual ?? "";
    const feedback = body?.feedback ?? "";
    const provider = body?.provider?.trim();
    const model = body?.model?.trim();

    if (!captionAtual.trim() || !feedback.trim()) {
      return reply.status(400).send({
        error: "Campos 'caption_atual' e 'feedback' são obrigatórios",
      });
    }

    const providerNorm = provider === "claude" ? "claude" : provider === "openai" ? "openai" : undefined;
    try {
      const caption = await refazerCaptionIA(captionAtual, feedback, {
        provider: providerNorm,
        model: model || undefined,
      });
      return reply.send({
        caption,
        media_url: undefined,
        media_type: undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao refazer caption";
      if (msg.includes("OPENAI_API_KEY") || msg.includes("ANTHROPIC_API_KEY")) {
        return reply.status(503).send({ error: msg });
      }
      fastify.log.error({ err }, "refazer-caption");
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /api/postador/publicar — JSON: { caption, media_url, media_type? }
  fastify.post("/publicar", async (request, reply) => {
    const body = request.body as { caption?: string; media_url?: string; media_type?: string };
    const caption = body?.caption ?? "";
    const mediaUrl = body?.media_url?.trim();
    const mediaType = (body?.media_type === "REELS" ? "REELS" : "IMAGE") as "IMAGE" | "REELS";

    if (!caption.trim()) {
      fastify.log.info({ reason: "caption_empty" }, "publicar 400");
      return reply.status(400).send({ error: "Campo 'caption' é obrigatório para publicar" });
    }
    if (!mediaUrl) {
      fastify.log.info({ reason: "media_url_missing" }, "publicar 400");
      return reply.status(400).send({
        error: "Para publicar no feed é necessário uma imagem ou vídeo. Envie um arquivo ao gerar o caption.",
      });
    }

    const config = await loadConfig();
    const token = config.instagram?.access_token?.trim();
    const igUserId = config.instagram?.ig_user_id?.trim();
    if (!token || !igUserId) {
      fastify.log.info({ reason: "instagram_credentials_missing", hasToken: Boolean(token), hasIgUserId: Boolean(igUserId) }, "publicar 400");
      return reply.status(400).send({
        error: "Configure as credenciais do Instagram em Administração: token de acesso e ID do usuário Instagram.",
      });
    }

    try {
      const result = await publishToInstagram(caption, mediaUrl, mediaType, token, igUserId);
      const dataPost = new Date().toISOString();
      await appendCronograma({
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
        id_container: result.id_container,
        link_post: result.link_post,
        data_post: dataPost,
      });
      return reply.send({
        ok: true,
        id_container: result.id_container,
        id_media: result.id_media,
        link_post: result.link_post,
        message: "Post publicado no Instagram.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao publicar no Instagram";
      fastify.log.error({ err }, "publicar");
      return reply.status(500).send({ error: msg });
    }
  });
};
