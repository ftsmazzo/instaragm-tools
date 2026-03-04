import type { FastifyPluginAsync } from "fastify";

/**
 * Rotas do Postador: gerar caption, refazer com feedback, publicar.
 * Por ora: respostas mock (sem MinIO, sem IA real, sem Graph API).
 * A integração com IA (OpenAI ou webhook n8n), MinIO e Instagram fica para as próximas etapas.
 */

function mockCaption(descricao: string): string {
  return `[Caption gerado para]\n\n${descricao}\n\n#FabriaIA #Instagram`;
}

function mockRefazerCaption(captionAtual: string, feedback: string): string {
  return `${captionAtual}\n\n---\n[Alteração solicitada: ${feedback}]`;
}

export const postadorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/postador/gerar-caption — JSON { descricao } (multipart com arquivo em versão futura)
  fastify.post("/gerar-caption", async (request, reply) => {
    const body = request.body as { descricao?: string };
    const descricao = body?.descricao ?? "";

    if (!descricao || descricao.trim() === "") {
      return reply.status(400).send({ error: "Campo 'descricao' é obrigatório" });
    }

    const caption = mockCaption(descricao.trim());
    return reply.send({
      caption,
      media_url: undefined,
      media_type: undefined,
    });
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

    const caption = mockRefazerCaption(captionAtual, feedback);
    // refazer_midia: por ora não geramos mídia; quando houver IA, usar para regenerar imagem
    return reply.send({
      caption,
      media_url: undefined,
      media_type: undefined,
    });
  });

  // POST /api/postador/publicar — JSON: { caption, media_url?, media_type? }
  fastify.post("/publicar", async (request, reply) => {
    const body = request.body as { caption?: string; media_url?: string; media_type?: string };
    const caption = body?.caption ?? "";

    if (!caption.trim()) {
      return reply.status(400).send({ error: "Campo 'caption' é obrigatório para publicar" });
    }

    // Mock: não chama MinIO nem Graph API; retorna sucesso
    return reply.send({
      ok: true,
      id_container: `mock-${Date.now()}`,
      message: "Publicação simulada. Integração com MinIO e Instagram Graph API em breve.",
    });
  });
};
