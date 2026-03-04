import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { loadConfig, saveConfig, type ConfigStore } from "../store/config.js";

export async function configRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET – obter configuração (para o painel; não expõe o token)
  app.get("/", async (_request, reply) => {
    const config = await loadConfig();
    const hasToken = Boolean(config.instagram?.access_token?.trim());
    const igUserId = config.instagram?.ig_user_id?.trim() ?? "";
    return reply.send({
      instagram: {
        connected: hasToken && Boolean(igUserId),
        ig_user_id: igUserId || undefined,
      },
      empresa: config.empresa ?? { nome: "" },
    });
  });

  // PUT – salvar configuração (token e ig_user_id para publicar no Instagram)
  app.put("/", async (request, reply) => {
    const body = request.body as {
      instagram?: { access_token?: string; ig_user_id?: string };
      empresa?: { nome?: string };
    };
    const update: Partial<ConfigStore> = {};
    if (body.instagram) {
      update.instagram = {};
      if (typeof body.instagram.access_token === "string") update.instagram.access_token = body.instagram.access_token;
      if (typeof body.instagram.ig_user_id === "string") update.instagram.ig_user_id = body.instagram.ig_user_id.trim();
    }
    if (body.empresa && typeof body.empresa.nome === "string") {
      update.empresa = { nome: body.empresa.nome };
    }
    const saved = await saveConfig(update);
    const hasToken = Boolean(saved.instagram?.access_token?.trim());
    const igUserId = saved.instagram?.ig_user_id?.trim() ?? "";
    return reply.send({
      saved: true,
      received: {
        instagram: { connected: hasToken && Boolean(igUserId), ig_user_id: igUserId || undefined },
        empresa: saved.empresa,
      },
    });
  });
}
