import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { postadorRoutes } from "./routes/postador.js";

const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB para futuro upload

  fastify.register(healthRoutes, { prefix: "/" });
  fastify.register(postadorRoutes, { prefix: "/api/postador" });

  const port = Number(process.env.PORT) || 3000;
  await fastify.listen({ host: "0.0.0.0", port });
  console.log(`API FabriaIA rodando em http://127.0.0.1:${port}`);
}

main().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
