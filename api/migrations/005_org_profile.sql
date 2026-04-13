-- Perfil da empresa na organização (contexto para agente / n8n). Espelhado em api/src/db/index.ts (ORG_PROFILE_COLS).

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS nome_fantasia text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS segmento text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cidade text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tom_voz text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sobre text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS objetivo_qualificacao text NOT NULL DEFAULT '';
