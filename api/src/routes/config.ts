import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function configRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET – obter configuração (tokens Instagram, dados empresa, etc.)
  app.get("/", async (_request, reply) => {
    return reply.send({
      instagram: { connected: false },
      empresa: { nome: "" },
      // TODO: buscar de banco/env
    });
  });

  // PUT/PATCH – salvar configuração (esqueleto)
  app.put("/", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    app.log.info({ body }, "config put");
    return reply.send({ saved: true, received: body });
  });
}
