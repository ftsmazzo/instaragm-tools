import type { FastifyPluginAsync } from "fastify";
import { gerarCaption as gerarCaptionIA, refazerCaption as refazerCaptionIA } from "../services/caption.js";

/**
 * Postador 100% no nosso sistema: IA (OpenAI) na API, sem n8n.
 * Gera e refaz caption; multipart para descricao + arquivo; publicação (MinIO + Graph API em implementação).
 */

export const postadorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/postador/gerar-caption — JSON { descricao } OU multipart (descricao + arquivo opcional)
  fastify.post("/gerar-caption", async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    let descricao = "";
    let mediaType: "IMAGE" | "REELS" | undefined;

    if (contentType.includes("multipart/form-data")) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "field" && part.fieldname === "descricao") {
          descricao = String(part.value ?? "").trim();
        }
        if (part.type === "file") {
          const mimetype = part.mimetype ?? "";
          if (mimetype.startsWith("video/")) mediaType = "REELS";
          else if (mimetype.startsWith("image/")) mediaType = "IMAGE";
          const file = part.file;
          for await (const _ of file) {
            // drain (MinIO upload em implementação)
          }
        }
      }
    } else {
      const body = request.body as { descricao?: string };
      descricao = (body?.descricao ?? "").trim();
    }

    if (!descricao) {
      return reply.status(400).send({ error: "Campo 'descricao' é obrigatório" });
    }

    try {
      const caption = await gerarCaptionIA(descricao, mediaType);
      return reply.send({
        caption,
        media_url: undefined,
        media_type: mediaType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar caption";
      if (msg.includes("OPENAI_API_KEY")) {
        return reply.status(503).send({ error: msg });
      }
      fastify.log.error({ err }, "gerar-caption");
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /api/postador/refazer-caption — JSON: { caption_atual, feedback, refazer_midia?: boolean }
  fastify.post("/refazer-caption", async (request, reply) => {
    const body = request.body as { caption_atual?: string; feedback?: string; refazer_midia?: boolean };
    const captionAtual = body?.caption_atual ?? "";
    const feedback = body?.feedback ?? "";

    if (!captionAtual.trim() || !feedback.trim()) {
      return reply.status(400).send({
        error: "Campos 'caption_atual' e 'feedback' são obrigatórios",
      });
    }

    try {
      const caption = await refazerCaptionIA(captionAtual, feedback);
      return reply.send({
        caption,
        media_url: undefined,
        media_type: undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao refazer caption";
      if (msg.includes("OPENAI_API_KEY")) {
        return reply.status(503).send({ error: msg });
      }
      fastify.log.error({ err }, "refazer-caption");
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /api/postador/publicar — JSON: { caption, media_url?, media_type? }
  fastify.post("/publicar", async (request, reply) => {
    const body = request.body as { caption?: string; media_url?: string; media_type?: string };
    const caption = body?.caption ?? "";

    if (!caption.trim()) {
      return reply.status(400).send({ error: "Campo 'caption' é obrigatório para publicar" });
    }

    // TODO: MinIO (upload se houver mídia) + Graph API com token da config
    return reply.send({
      ok: true,
      id_container: `mock-${Date.now()}`,
      message: "Publicação simulada. Integração MinIO + Instagram Graph API em implementação.",
    });
  });
};
