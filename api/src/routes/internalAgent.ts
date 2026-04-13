import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getPool, isDbConfigured, ensureTables } from "../db/index.js";

const HEADER = "x-internal-secret";

/**
 * GET /api/internal/agent-config?ig_user_id=... ou ?conta_id=...
 * Header: X-Internal-Secret: INTERNAL_AGENT_API_SECRET
 * Uso: n8n / automações para obter token do agente e prompts (não expor no painel).
 */
export async function internalAgentRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/agent-config", async (request, reply) => {
    const secret = process.env.INTERNAL_AGENT_API_SECRET?.trim();
    if (!secret) {
      return reply.status(503).send({ error: "INTERNAL_AGENT_API_SECRET não configurado." });
    }
    if (!isDbConfigured()) {
      return reply.status(503).send({ error: "Banco não configurado." });
    }
    const hdr = request.headers[HEADER];
    const sent = typeof hdr === "string" ? hdr : Array.isArray(hdr) ? hdr[0] : "";
    if (!sent || sent !== secret) {
      return reply.status(401).send({ error: "Não autorizado." });
    }

    const q = request.query as { ig_user_id?: string; conta_id?: string };
    const igUserId = (q.ig_user_id ?? "").trim();
    const contaId = (q.conta_id ?? "").trim();
    if (!igUserId && !contaId) {
      return reply.status(400).send({ error: "Informe ig_user_id ou conta_id." });
    }

    await ensureTables();
    const pool = getPool();
    const orgJoinCols = `
                  ia.organization_id::text AS organization_id,
                  o.name AS org_name,
                  COALESCE(o.nome_fantasia, '') AS org_nome_fantasia,
                  COALESCE(o.segmento, '') AS org_segmento,
                  COALESCE(o.cidade, '') AS org_cidade,
                  COALESCE(o.tom_voz, '') AS org_tom_voz,
                  COALESCE(o.sobre, '') AS org_sobre,
                  COALESCE(o.objetivo_qualificacao, '') AS org_objetivo_qualificacao`;

    const r = contaId
      ? await pool.query<{
          id: string;
          nome: string;
          ig_user_id: string;
          access_token: string;
          agent_access_token: string;
          agent_ativo: boolean;
          agent_nome: string;
          agent_prompt_comentarios: string;
          agent_prompt_direct: string;
          organization_id: string;
          org_name: string;
          org_nome_fantasia: string;
          org_segmento: string;
          org_cidade: string;
          org_tom_voz: string;
          org_sobre: string;
          org_objetivo_qualificacao: string;
        }>(
          `SELECT ia.id, ia.nome, ia.ig_user_id, ia.access_token,
                  COALESCE(ia.agent_access_token, '') AS agent_access_token,
                  COALESCE(ia.agent_ativo, false) AS agent_ativo,
                  COALESCE(ia.agent_nome, '') AS agent_nome,
                  COALESCE(ia.agent_prompt_comentarios, '') AS agent_prompt_comentarios,
                  COALESCE(ia.agent_prompt_direct, '') AS agent_prompt_direct,
                  ${orgJoinCols}
           FROM instagram_accounts ia
           JOIN organizations o ON o.id = ia.organization_id
           WHERE ia.id = $1
           LIMIT 1`,
          [contaId]
        )
      : await pool.query<{
          id: string;
          nome: string;
          ig_user_id: string;
          access_token: string;
          agent_access_token: string;
          agent_ativo: boolean;
          agent_nome: string;
          agent_prompt_comentarios: string;
          agent_prompt_direct: string;
          organization_id: string;
          org_name: string;
          org_nome_fantasia: string;
          org_segmento: string;
          org_cidade: string;
          org_tom_voz: string;
          org_sobre: string;
          org_objetivo_qualificacao: string;
        }>(
          `SELECT ia.id, ia.nome, ia.ig_user_id, ia.access_token,
                  COALESCE(ia.agent_access_token, '') AS agent_access_token,
                  COALESCE(ia.agent_ativo, false) AS agent_ativo,
                  COALESCE(ia.agent_nome, '') AS agent_nome,
                  COALESCE(ia.agent_prompt_comentarios, '') AS agent_prompt_comentarios,
                  COALESCE(ia.agent_prompt_direct, '') AS agent_prompt_direct,
                  ${orgJoinCols}
           FROM instagram_accounts ia
           JOIN organizations o ON o.id = ia.organization_id
           WHERE ia.ig_user_id = $1
           LIMIT 1`,
          [igUserId]
        );
    const row = r.rows[0];
    if (!row) {
      return reply.status(404).send({ error: "Conta não encontrada." });
    }

    let crm_resumo = { leads: 0, comentarios: 0, direct: 0 };
    try {
      const c = await pool.query<{
        leads: number;
        comentarios: number;
        direct: number;
      }>(
        `SELECT
          (SELECT COUNT(*)::int FROM leads WHERE organization_id = $1::uuid) AS leads,
          (SELECT COUNT(*)::int FROM comentarios WHERE organization_id = $1::uuid) AS comentarios,
          (SELECT COUNT(*)::int FROM direct WHERE organization_id = $1::uuid) AS direct`,
        [row.organization_id]
      );
      const z = c.rows[0];
      if (z) crm_resumo = { leads: z.leads, comentarios: z.comentarios, direct: z.direct };
    } catch {
      /* tabelas CRM ainda não criadas ou schema antigo */
    }

    return reply.send({
      ok: true,
      conta_id: row.id,
      ig_user_id: row.ig_user_id,
      nome: row.nome,
      organization_id: row.organization_id,
      empresa_nome: row.org_name,
      empresa_perfil: {
        nome: row.org_name,
        nome_fantasia: row.org_nome_fantasia,
        segmento: row.org_segmento,
        cidade: row.org_cidade,
        tom_voz: row.org_tom_voz,
        sobre: row.org_sobre,
        objetivo_qualificacao: row.org_objetivo_qualificacao,
      },
      crm_resumo,
      agent_ativo: row.agent_ativo,
      agent_nome: row.agent_nome,
      agent_prompt_comentarios: row.agent_prompt_comentarios,
      agent_prompt_direct: row.agent_prompt_direct,
      /** Token de publicação (Graph API) — útil se o workflow publicar e responder no mesmo fluxo. */
      access_token: row.access_token,
      agent_access_token: row.agent_access_token,
    });
  });
}
