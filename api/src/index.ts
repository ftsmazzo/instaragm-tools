import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { configRoutes } from "./routes/config.js";
import { postagensRoutes } from "./routes/postagens.js";
import { agentesRoutes } from "./routes/agentes.js";
import { postadorRoutes } from "./routes/postador.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function build() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  await app.register(healthRoutes, { prefix: "/" });
  await app.register(configRoutes, { prefix: "/api/config" });
  await app.register(postagensRoutes, { prefix: "/api/postagens" });
  await app.register(agentesRoutes, { prefix: "/api/agentes" });
  await app.register(postadorRoutes, { prefix: "/api/postador" });

  return app;
}

build()
  .then((app) => app.listen({ port: PORT, host: HOST }))
  .then((address) => {
    console.log(`API FabriaIA rodando em ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
