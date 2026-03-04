import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    return reply.send({ ok: true, service: "fabricaia-api", version: "0.1.0" });
  });

  app.get("/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });
};
