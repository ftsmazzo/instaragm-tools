import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_request, reply) => {
    return reply.send({ ok: true, service: "agente-instagram-api", version: "0.1.0" });
  });

  fastify.get("/health", async (_request, reply) => {
    return reply.send({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  });
};
