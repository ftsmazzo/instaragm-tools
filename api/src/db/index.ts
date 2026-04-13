import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!DATABASE_URL.trim()) {
    throw new Error("DATABASE_URL não configurada");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export function isDbConfigured(): boolean {
  return Boolean(DATABASE_URL?.trim());
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS postador_cronograma (
  id text PRIMARY KEY,
  caption text NOT NULL,
  media_url text,
  media_type text,
  id_container text,
  link_post text,
  data_post text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS postador_agendados (
  id text PRIMARY KEY,
  caption text NOT NULL,
  media_url text,
  media_urls jsonb,
  media_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_instagram_account_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  nome text NOT NULL,
  ig_user_id text NOT NULL,
  access_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_org ON instagram_accounts (organization_id);
`;

let initDone = false;

export async function ensureTables(): Promise<void> {
  if (!isDbConfigured() || initDone) return;
  const p = getPool();
  await p.query(INIT_SQL);
  initDone = true;
}
