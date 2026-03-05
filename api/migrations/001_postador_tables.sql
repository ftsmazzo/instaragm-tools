-- Tabelas para config (Instagram, empresa) e cronograma do Postador.
-- Rode este arquivo no PostgreSQL se as tabelas não forem criadas pela API na subida.
-- Ex.: psql -h HOST -U USER -d DBNAME -f api/migrations/001_postador_tables.sql

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
