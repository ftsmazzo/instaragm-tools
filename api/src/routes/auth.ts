import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import bcrypt from "bcryptjs";
import { isDbConfigured } from "../db/index.js";
import {
  countUsers,
  createUserWithOrganization,
  findUserByEmail,
  userHasOrg,
  copyLegacyConfigIntoWorkspace,
} from "../store/workspace.js";

export async function authRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get("/status", async (_request, reply) => {
    if (!isDbConfigured()) {
      return reply.send({
        database: false,
        hasUsers: false,
        allowRegister: false,
        authMode: "legacy",
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
    });
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
}
