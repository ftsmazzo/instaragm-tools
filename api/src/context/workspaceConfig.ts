import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadConfig, type ConfigStore } from "../store/config.js";
import { loadWorkspaceConfigStore } from "../store/workspace.js";

type JwtUser = { sub: string; orgId: string; email: string };

/**
 * JWT com workspace → contas Instagram da organização.
 * Sem token ou token inválido → config legada (`app_config` / arquivo).
 */
export async function resolveConfigStore(app: FastifyInstance, request: FastifyRequest): Promise<ConfigStore> {
  const hdr = request.headers.authorization;
  if (!hdr?.startsWith("Bearer ")) {
    return loadConfig();
  }
  const raw = hdr.slice(7).trim();
  if (!raw) return loadConfig();
  try {
    const payload = (await app.jwt.verify<JwtUser>(raw)) as JwtUser;
    if (payload?.orgId) {
      // Com JWT nunca misturamos com app_config legado (evita usar token de outro cliente no mesmo servidor).
      return loadWorkspaceConfigStore(payload.orgId);
    }
  } catch {
    // token inválido ou expirado
  }
  return loadConfig();
}
