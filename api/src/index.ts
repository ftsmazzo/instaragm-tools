import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { configRoutes } from "./routes/config.js";
import { postagensRoutes } from "./routes/postagens.js";
import { agentesRoutes } from "./routes/agentes.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function build() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true, // em produção definir origens permitidas
  });

  await app.register(healthRoutes, { prefix: "/" });
  await app.register(configRoutes, { prefix: "/api/config" });
  await app.register(postagensRoutes, { prefix: "/api/postagens" });
  await app.register(agentesRoutes, { prefix: "/api/agentes" });

  return app;
}

build()
  .then((app) => {
    return app.listen({ port: PORT, host: HOST });
  })
  .then((address) => {
    console.log(`API FabriaIA rodando em ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
