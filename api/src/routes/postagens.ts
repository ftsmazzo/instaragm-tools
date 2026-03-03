import type { FastifyInstance, FastifyPluginOptions } from "fastify";

const WEBHOOK_URL = process.env.N8N_WEBHOOK_RASPAR_POSTAGENS || "";

// Último resultado da raspagem (em memória)
let lastRasparResult: unknown[] = [];

function toItemsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown[] }).data)) return (raw as { data: unknown[] }).data;
  if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as { items: unknown[] }).items)) return (raw as { items: unknown[] }).items;
  return [raw];
}

export async function postagensRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET – listar postagens (última raspagem)
  app.get("/", async (_request, reply) => {
    return reply.send({
      postagens: lastRasparResult,
      total: lastRasparResult.length,
    });
  });

  // POST – disparar raspagem via webhook n8n
  app.post("/raspar", async (_request, reply) => {
    if (!WEBHOOK_URL) {
      return reply.status(500).send({
        error: "N8N_WEBHOOK_RASPAR_POSTAGENS não configurado",
      });
    }
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const raw = await res.json().catch(() => ({}));
      lastRasparResult = toItemsArray(raw);
      app.log.info({ total: lastRasparResult.length }, "raspar ok");
      return reply.send({
        triggered: true,
        postagens: lastRasparResult,
        total: lastRasparResult.length,
      });
    } catch (err) {
      app.log.error({ err }, "raspar falhou");
      return reply.status(502).send({
        error: "Falha ao chamar webhook n8n",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
