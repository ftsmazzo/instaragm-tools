import type { FastifyPluginAsync } from "fastify";
import { gerarCaption as gerarCaptionIA, refazerCaption as refazerCaptionIA } from "../services/caption.js";

/**
 * Postador 100% no nosso sistema: IA (OpenAI) na API, sem n8n.
 * Gera e refaz caption; multipart para descricao + arquivo; publicação (MinIO + Graph API em implementação).
 */

export const postadorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/postador/gerar-caption — JSON { descricao, provider?, model? } OU multipart (descricao + arquivo + provider + model)
  fastify.post("/gerar-caption", async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    let descricao = "";
    let mediaType: "IMAGE" | "REELS" | undefined;
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
        media_url: undefined,
        media_type: mediaType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar caption";
      if (msg.includes("OPENAI_API_KEY") || msg.includes("ANTHROPIC_API_KEY")) {
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
