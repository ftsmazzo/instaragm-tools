import crypto from "crypto";

const GRAPH_DEFAULT = "v21.0";

export type MetaOAuthEnv = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphVersion: string;
  scopes: string;
  stateSecret: string;
};

export function getMetaOAuthEnv(): MetaOAuthEnv | null {
  const appId = process.env.META_APP_ID?.trim() ?? "";
  const appSecret = process.env.META_APP_SECRET?.trim() ?? "";
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim() ?? "";
  if (!appId || !appSecret || !redirectUri) return null;
  let graphVersion = process.env.META_GRAPH_VERSION?.trim() || GRAPH_DEFAULT;
  if (!graphVersion.startsWith("v")) graphVersion = `v${graphVersion}`;
  const scopes =
    process.env.META_OAUTH_SCOPES?.trim() ||
    [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "business_management",
    ].join(",");
  const stateSecret = process.env.META_OAUTH_STATE_SECRET?.trim() || process.env.JWT_SECRET?.trim() || "dev-meta-state";
  return { appId, appSecret, redirectUri, graphVersion, scopes, stateSecret };
}

export function isMetaOAuthConfigured(): boolean {
  return getMetaOAuthEnv() !== null;
}

type StatePayload = { orgId: string; sub: string; exp: number };

const STATE_TTL_MS = 20 * 60 * 1000;

export function signMetaOAuthState(orgId: string, sub: string, secret: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const payload: StatePayload = { orgId, sub, exp };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyMetaOAuthState(state: string, secret: string): StatePayload | null {
  const i = state.lastIndexOf(".");
  if (i <= 0) return null;
  const data = state.slice(0, i);
  const sig = state.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as StatePayload;
    if (typeof parsed.orgId !== "string" || typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildFacebookAuthorizeUrl(env: MetaOAuthEnv, state: string): string {
  const u = new URL(`https://www.facebook.com/${env.graphVersion}/dialog/oauth`);
  u.searchParams.set("client_id", env.appId);
  u.searchParams.set("redirect_uri", env.redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", env.scopes);
  return u.toString();
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const u = new URL(`https://graph.facebook.com/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), { method: "GET" });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = (json as { error?: { message?: string } }).error?.message ?? `Graph HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** Troca code por token de usuário (curta duração) e depois por longa duração. */
export async function exchangeCodeForLongLivedUserToken(
  env: MetaOAuthEnv,
  code: string
): Promise<{ access_token: string }> {
  const short = await graphGet<{ access_token: string }>(`${env.graphVersion}/oauth/access_token`, {
    client_id: env.appId,
    client_secret: env.appSecret,
    redirect_uri: env.redirectUri,
    code,
  });

  const long = await graphGet<{ access_token: string }>(`${env.graphVersion}/oauth/access_token`, {
    grant_type: "fb_exchange_token",
    client_id: env.appId,
    client_secret: env.appSecret,
    fb_exchange_token: short.access_token,
  });
  return long;
}

export type PageWithInstagram = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

export async function fetchPagesWithInstagram(env: MetaOAuthEnv, userAccessToken: string): Promise<PageWithInstagram[]> {
  const fields = "id,name,access_token,instagram_business_account{id,username,name}";
  const json = await graphGet<{ data?: PageWithInstagram[] }>(`${env.graphVersion}/me/accounts`, {
    fields,
    access_token: userAccessToken,
  });
  return json.data ?? [];
}
