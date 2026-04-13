-- Agente Instagram (Direct / comentários): token e prompts separados do token de publicação.
-- Aplicado também via ensureTables() na API.

ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS agent_access_token text NOT NULL DEFAULT '';
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS agent_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS agent_nome text NOT NULL DEFAULT '';
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS agent_prompt_comentarios text NOT NULL DEFAULT '';
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS agent_prompt_direct text NOT NULL DEFAULT '';

COMMENT ON COLUMN instagram_accounts.access_token IS 'Token Graph API para publicar conteúdo (Postador).';
COMMENT ON COLUMN instagram_accounts.agent_access_token IS 'Token para automações de agente (HTTP Header em chamadas graph.instagram.com no n8n, etc.).';
COMMENT ON COLUMN instagram_accounts.agent_ativo IS 'Se true, exposto em GET /api/internal/agent-config para o workflow.';
