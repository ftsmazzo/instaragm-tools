import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { parseMetaSignedRequest } from "../util/metaSignedRequest.js";
import { isDbConfigured } from "../db/index.js";
import {
  countUsers,
  createUserWithOrganization,
  findUserByEmail,
  userHasOrg,
  userBelongsToOrg,
  copyLegacyConfigIntoWorkspace,
} from "../store/workspace.js";
import {
  exchangeCodeForLongLivedUserToken,
  exchangeInstagramCodeForLongLivedToken,
  fetchInstagramBusinessMe,
  fetchPagesWithInstagram,
  getMetaOAuthEnv,
  getMetaOAuthMode,
  isMetaOAuthConfigured,
  pagesFromInstagramDirectAuth,
  verifyMetaOAuthState,
} from "../services/metaOAuth.js";
import { mergeInstagramPagesIntoWorkspace } from "../services/metaOAuthWorkspace.js";

export async function authRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/status", async (_request, reply) => {
    if (!isDbConfigured()) {
    return reply.send({
      database: false,
      hasUsers: false,
      allowRegister: false,
      authMode: "legacy",
      metaOAuthConfigured: false,
      metaOAuthMode: "facebook" as const,
      message: "Sem DATABASE_URL: use apenas /api/config (modo legado).",
    });
    }
    const n = await countUsers();
    const allowOpen = process.env.ALLOW_OPEN_REGISTER === "true";
    return reply.send({
      database: true,
      hasUsers: n > 0,
      allowRegister: n === 0 || allowOpen,
      authMode: "workspace",
      metaOAuthConfigured: isMetaOAuthConfigured(),
      metaOAuthMode: getMetaOAuthMode(),
    });
  });

  /** Callback público do Facebook Login (sem JWT). Redireciona de volta ao painel. */
  app.get("/meta/callback", async (request, reply) => {
    const env = getMetaOAuthEnv();
    const baseRedirect = (process.env.PAINEL_PUBLIC_URL?.trim().replace(/\/$/, "") || "http://localhost:5173").trim();
    const fail = (reason: string) =>
      reply
        .code(302)
        .redirect(`${baseRedirect}/admin?meta_oauth=err&reason=${encodeURIComponent(reason.slice(0, 500))}`);
    try {
      if (!env) return fail("OAuth Meta não configurado na API (META_APP_ID / SECRET / REDIRECT_URI).");
      const q = request.query as { code?: string; state?: string; error?: string; error_description?: string };
      if (q.error) return fail((q.error_description || q.error || "login_cancelado").replace(/\+/g, " "));
      const code = q.code?.trim();
      const state = q.state?.trim();
      if (!code || !state) return fail("Resposta inválida do Facebook.");
      const payload = verifyMetaOAuthState(state, env.stateSecret);
      if (!payload) return fail("Sessão expirada ou inválida. Abra Conectar de novo na Administração.");
      const member = await userBelongsToOrg(payload.sub, payload.orgId);
      if (!member) return fail("Usuário não autorizado para esta organização.");
      if (getMetaOAuthMode() === "instagram") {
        const long = await exchangeInstagramCodeForLongLivedToken(env, code);
        const me = await fetchInstagramBusinessMe(env, long.access_token);
        const pages = pagesFromInstagramDirectAuth(long.access_token, me);
        await mergeInstagramPagesIntoWorkspace(payload.orgId, pages);
      } else {
        const long = await exchangeCodeForLongLivedUserToken(env, code);
        const pages = await fetchPagesWithInstagram(env, long.access_token);
        await mergeInstagramPagesIntoWorkspace(payload.orgId, pages);
      }
      return reply.code(302).redirect(`${baseRedirect}/admin?meta_oauth=ok`);
    } catch (err) {
      request.log.error({ err }, "meta oauth callback");
      const msg = err instanceof Error ? err.message : "Erro ao conectar.";
      return fail(msg);
    }
  });

  app.post("/register", async (request, reply) => {
    if (!isDbConfigured()) {
      return reply.status(503).send({ error: "Banco não configurado." });
    }
    const body = request.body as {
      email?: string;
      password?: string;
      organizationName?: string;
    };
    const email = (body?.email ?? "").trim();
    const password = body?.password ?? "";
    const organizationName = (body?.organizationName ?? "").trim() || "Minha empresa";
    if (!email || !password) {
      return reply.status(400).send({ error: "Informe e-mail e senha." });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: "Senha deve ter pelo menos 8 caracteres." });
    }
    const n = await countUsers();
    const allowOpen = process.env.ALLOW_OPEN_REGISTER === "true";
    if (n > 0 && !allowOpen) {
      return reply.status(403).send({
        error: "Cadastro público desativado. Defina ALLOW_OPEN_REGISTER=true no servidor para novos registros.",
      });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: "Este e-mail já está cadastrado." });
    }
    const password_hash = await bcrypt.hash(password, 10);
    try {
      const { userId, orgId } = await createUserWithOrganization(email, password_hash, organizationName);
      await copyLegacyConfigIntoWorkspace(orgId);
      const token = await reply.jwtSign({ sub: userId, orgId, email: email.toLowerCase() });
      return reply.send({
        token,
        user: { email: email.toLowerCase(), organization_id: orgId },
      });
    } catch (err) {
      app.log.error({ err }, "register");
      return reply.status(500).send({ error: "Não foi possível criar a conta." });
    }
  });

  app.post("/login", async (request, reply) => {
    if (!isDbConfigured()) {
      return reply.status(503).send({ error: "Banco não configurado." });
    }
    const body = request.body as { email?: string; password?: string };
    const email = (body?.email ?? "").trim();
    const password = body?.password ?? "";
    if (!email || !password) {
      return reply.status(400).send({ error: "Informe e-mail e senha." });
    }
    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: "E-mail ou senha incorretos." });
    }
    const org = await userHasOrg(user.id);
    if (!org) {
      return reply.status(403).send({ error: "Usuário sem organização vinculada." });
    }
    const token = await reply.jwtSign({
      sub: user.id,
      orgId: org.orgId,
      email: email.toLowerCase(),
    });
    return reply.send({
      token,
      user: { email: email.toLowerCase(), organization_id: org.orgId },
    });
  });

  app.get("/me", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Não autorizado." });
    }
    const u = request.user as { sub: string; orgId: string; email: string };
    return reply.send({
      user: { id: u.sub, email: u.email, organization_id: u.orgId },
    });
  });

  /**
   * Desautorização: a Meta envia POST (form) com signed_request quando o usuário remove o app.
   * Cadastre a mesma URL no painel do app (login da empresa / configurações avançadas).
   */
  app.post("/meta/deauthorize", async (request, reply) => {
    const secret = process.env.META_APP_SECRET?.trim();
    if (!secret) return reply.code(503).send("META_APP_SECRET não configurado.");
    const body = request.body as { signed_request?: string };
    const signedRequest = body?.signed_request?.trim();
    if (!signedRequest) return reply.code(400).send("signed_request ausente.");
    const data = parseMetaSignedRequest(signedRequest, secret);
    if (!data) return reply.code(400).send("signed_request inválido.");
    request.log.info({ meta_deauth: data }, "Meta desautorizou o app");
    return reply.code(200).send();
  });

  /**
   * Exclusão de dados (LGPD / políticas Meta): POST com signed_request; resposta JSON exigida pela Meta.
   * GET = página informativa para humanos ou validação de URL.
   */
  app.get("/meta/data-deletion", async (_request, reply) => {
    const contact = process.env.META_DATA_DELETION_CONTACT_EMAIL?.trim() || "o suporte da sua empresa";
    reply.type("text/html; charset=utf-8");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Exclusão de dados</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem">
<h1>Exclusão de dados (Meta / Instagram)</h1>
<p>Para solicitar a remoção dos dados associados ao nosso aplicativo após usar o login Meta/Instagram, envie um e-mail para <strong>${contact}</strong> com o assunto &quot;Exclusão de dados Meta&quot; e, se possível, o e-mail da sua conta no painel.</p>
<p>Se você chegou aqui pela Meta após pedir exclusão, use o código exibido na tela de confirmação da Meta ou o link de status que recebeu.</p>
</body></html>`;
  });

  app.post("/meta/data-deletion", async (request, reply) => {
    const secret = process.env.META_APP_SECRET?.trim();
    if (!secret) return reply.code(503).send({ error: "META_APP_SECRET não configurado." });
    const body = request.body as { signed_request?: string };
    const signedRequest = body?.signed_request?.trim();
    if (!signedRequest) return reply.code(400).send({ error: "signed_request ausente." });
    const data = parseMetaSignedRequest(signedRequest, secret);
    if (!data) return reply.code(400).send({ error: "signed_request inválido." });
    const confirmation_code = `del_${crypto.randomBytes(10).toString("hex")}`;
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const url = `${baseUrl}/api/auth/meta/data-deletion/status?c=${encodeURIComponent(confirmation_code)}`;
    request.log.info({ meta_data_deletion: data, confirmation_code }, "Meta pedido de exclusão de dados");
    return reply.send({ url, confirmation_code });
  });

  app.get("/meta/data-deletion/status", async (request, reply) => {
    const c = ((request.query as { c?: string }).c ?? "").trim();
    reply.type("text/html; charset=utf-8");
    const safe = c.replace(/</g, "").replace(/"/g, "");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Status da exclusão</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem">
<h1>Solicitação registrada</h1>
<p>Seu pedido de exclusão foi recebido. Guarde o código de confirmação:</p>
<p style="font-size:1.25rem;font-weight:600">${safe || "—"}</p>
<p>Em até 24 horas úteis os dados vinculados ao app serão tratados conforme nossa política de privacidade. Dúvidas: ${process.env.META_DATA_DELETION_CONTACT_EMAIL?.trim() || "suporte."}</p>
</body></html>`;
  });
}
