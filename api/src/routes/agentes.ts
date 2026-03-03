import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function agentesRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET – listar leads/conversas (esqueleto)
  app.get("/leads", async (_request, reply) => {
    return reply.send({
      leads: [],
      total: 0,
      // TODO: integrar com n8n/PostgreSQL
    });
  });

  // GET – configuração dos agentes (comentários / direct)
  app.get("/config", async (_request, reply) => {
    return reply.send({
      comentarios: { ativo: false },
      direct: { ativo: false },
      // TODO: persistir e retornar do banco
    });
  });
}
