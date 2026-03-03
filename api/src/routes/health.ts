import type { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function healthRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/", async (_request, reply) => {
    return reply.send({ ok: true, service: "fabricaia-api", version: "0.1.0" });
  });

  app.get("/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });
}
