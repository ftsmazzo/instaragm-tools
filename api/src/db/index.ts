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
`;

let initDone = false;

export async function ensureTables(): Promise<void> {
  if (!isDbConfigured() || initDone) return;
  const p = getPool();
  await p.query(INIT_SQL);
  initDone = true;
}
