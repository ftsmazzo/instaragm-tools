-- CRM do agente Instagram: mesmas entidades do workflow n8n (postagens, comentarios, direct, leads),
-- com escopo por organização (multi-tenant). Mesmo DATABASE_URL da API.
-- Aplicado via ensureTables() na subida da API (SQL espelhado em api/src/db/index.ts).
--
-- Migração a partir de banco antigo só-n8n (tabelas sem organization_id):
-- faça backup, remova ou renomeie as tabelas antigas com o mesmo nome, depois suba a API
-- para recriar o schema multi-tenant; em seguida aponte o n8n para este DATABASE_URL
-- e ajuste INSERT/SELECT para incluir organization_id (ex.: vindo do GET /api/internal/agent-config).

-- Postagens (cache de mídia / legenda para contexto da IA)
CREATE TABLE IF NOT EXISTS postagens (
  id                SERIAL PRIMARY KEY,
  organization_id   uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  instagram_account_id text NULL REFERENCES instagram_accounts (id) ON DELETE SET NULL,
  id_post           VARCHAR(64) NOT NULL,
  caption_post      TEXT,
  media_type        VARCHAR(32),
  media_url         TEXT,
  link_post         TEXT,
  data_post         TIMESTAMPTZ,
  media_description TEXT,
  hashtags          TEXT,
  mencoes           TEXT,
  processado        BOOLEAN NOT NULL DEFAULT false,
  processado_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT postagens_org_id_post_key UNIQUE (organization_id, id_post)
);

CREATE INDEX IF NOT EXISTS idx_postagens_org ON postagens (organization_id);
CREATE INDEX IF NOT EXISTS idx_postagens_created_at ON postagens (created_at DESC);

-- Comentários recebidos via webhook
CREATE TABLE IF NOT EXISTS comentarios (
  id                         SERIAL PRIMARY KEY,
  organization_id            uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  instagram_account_id       text NULL REFERENCES instagram_accounts (id) ON DELETE SET NULL,
  id_postagem                VARCHAR(64) NOT NULL,
  id_comentario              VARCHAR(64) NOT NULL,
  media_type                 VARCHAR(32),
  id_insta_lead              VARCHAR(64),
  username_lead              VARCHAR(255),
  comment_text               TEXT,
  interaction_type           VARCHAR(64),
  origem                     VARCHAR(64),
  data_comentario            TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_direct_resposta_privada VARCHAR(255),
  CONSTRAINT comentarios_org_comment_key UNIQUE (organization_id, id_comentario)
);

CREATE INDEX IF NOT EXISTS idx_comentarios_org ON comentarios (organization_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_data ON comentarios (data_comentario DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_comentarios_postagem ON comentarios (id_postagem);
CREATE INDEX IF NOT EXISTS idx_comentarios_lead ON comentarios (id_insta_lead);

-- Mensagens Direct (webhook + private reply enviada pelo negócio)
CREATE TABLE IF NOT EXISTS direct (
  id                      SERIAL PRIMARY KEY,
  organization_id         uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  instagram_account_id    text NULL REFERENCES instagram_accounts (id) ON DELETE SET NULL,
  id_direct               VARCHAR(255) NOT NULL,
  id_insta_lead           VARCHAR(64),
  username_lead           VARCHAR(255),
  direct_text             TEXT,
  interaction_type      VARCHAR(64) NOT NULL DEFAULT 'Direct',
  origem                  VARCHAR(64),
  data_direct             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_comentario_origem    VARCHAR(64),
  enviado_pelo_negocio    BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT direct_org_message_key UNIQUE (organization_id, id_direct)
);

CREATE INDEX IF NOT EXISTS idx_direct_org ON direct (organization_id);
CREATE INDEX IF NOT EXISTS idx_direct_lead ON direct (id_insta_lead);
CREATE INDEX IF NOT EXISTS idx_direct_data ON direct (data_direct DESC NULLS LAST);

-- Leads (identidade / WhatsApp / objetivo) — mesmo IG pode ser lead em orgs diferentes
CREATE TABLE IF NOT EXISTS leads (
  id                         SERIAL PRIMARY KEY,
  organization_id            uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  instagram_account_id       text NULL REFERENCES instagram_accounts (id) ON DELETE SET NULL,
  id_instagram               VARCHAR(64) NOT NULL,
  username_instagram         VARCHAR(255),
  nome                       VARCHAR(255),
  whatsapp                   VARCHAR(32),
  objetivo                   VARCHAR(128),
  origem_primeiro_contato    VARCHAR(64),
  profile_pic_url            TEXT,
  seguidores                 INTEGER,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_org_instagram_key UNIQUE (organization_id, id_instagram)
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads (updated_at DESC);

COMMENT ON TABLE postagens IS 'Posts Instagram (Meta) por organização; contexto para agente.';
COMMENT ON TABLE comentarios IS 'Comentários Instagram por organização.';
COMMENT ON TABLE direct IS 'DM Instagram por organização.';
COMMENT ON TABLE leads IS 'Leads por organização; id_instagram escopado por organization_id.';
