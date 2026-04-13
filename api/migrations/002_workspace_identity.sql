-- Máquina de vendas: organização (cliente), usuários e contas Instagram normalizadas.
-- A API também aplica este DDL em ensureTables() quando DATABASE_URL está definida.
-- Mantém app_config (legado) até migração completa do painel para /api/me/workspace.

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

COMMENT ON TABLE organizations IS 'Cliente / empresa no painel (tenant lógico).';
COMMENT ON TABLE instagram_accounts IS 'Contas Instagram da organização; access_token sensível — proteger API.';
COMMENT ON TABLE org_members IS 'Usuário pertence a uma ou mais organizações (MVP: uma org por usuário comum).';
