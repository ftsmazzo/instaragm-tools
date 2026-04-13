import { getPool, ensureTables, isDbConfigured } from "../db/index.js";

function hashtagsFromCaption(caption: string): string | null {
  const tags = caption.match(/#[^\s#]+/g);
  if (!tags?.length) return null;
  return [...new Set(tags.map((t) => t.slice(1)))].join(", ");
}

function mencoesFromCaption(caption: string): string | null {
  const m = caption.match(/@[^\s@]+/g);
  if (!m?.length) return null;
  return [...new Set(m.map((x) => x.slice(1)))].join(", ");
}

export type UpsertPostagemFromPostadorParams = {
  organizationId: string;
  instagramAccountId: string;
  idPost: string;
  caption: string;
  mediaType: string | null;
  mediaUrl: string | null;
  linkPost: string | null;
  dataPost: string;
};

/**
 * Grava/atualiza linha em `postagens` (CRM) após publicação pelo Postador.
 * `id_post` = id da mídia publicada no Graph (mesmo usado em webhooks).
 */
export async function upsertPostagemFromPostador(params: UpsertPostagemFromPostadorParams): Promise<void> {
  if (!isDbConfigured()) return;
  await ensureTables();
  const pool = getPool();
  const hashtags = hashtagsFromCaption(params.caption);
  const mencoes = mencoesFromCaption(params.caption);
  await pool.query(
    `INSERT INTO postagens (
      organization_id, instagram_account_id, id_post, caption_post, media_type, media_url, link_post, data_post,
      hashtags, mencoes, processado, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, false, NOW())
    ON CONFLICT (organization_id, id_post) DO UPDATE SET
      caption_post = EXCLUDED.caption_post,
      media_type = EXCLUDED.media_type,
      media_url = EXCLUDED.media_url,
      link_post = EXCLUDED.link_post,
      data_post = EXCLUDED.data_post,
      hashtags = EXCLUDED.hashtags,
      mencoes = EXCLUDED.mencoes,
      instagram_account_id = COALESCE(EXCLUDED.instagram_account_id, postagens.instagram_account_id),
      updated_at = NOW()`,
    [
      params.organizationId,
      params.instagramAccountId,
      params.idPost,
      params.caption,
      params.mediaType,
      params.mediaUrl,
      params.linkPost,
      params.dataPost,
      hashtags,
      mencoes,
    ]
  );
}
