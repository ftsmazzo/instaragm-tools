import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function postagensRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET – listar postagens (raspadas)
  app.get("/", async (_request, reply) => {
    return reply.send({
      postagens: [],
      total: 0,
      // TODO: integrar com fonte real (n8n/DB)
    });
  });

  // POST – disparar raspagem (esqueleto)
  app.post("/raspar", async (_request, reply) => {
    app.log.info("postagens raspar");
    return reply.send({
      triggered: true,
      message: "Raspagem em fila (implementar com n8n/worker)",
    });
  });
}
