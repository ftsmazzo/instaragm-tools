const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export type PublishResult = {
  id_container: string;
  id_media: string;
  link_post: string | null;
};

/**
 * Cria um container de mídia (imagem ou Reels) e publica no Instagram.
 * Requer token e ig_user_id da conta profissional vinculada à página.
 */
export async function publishToInstagram(
  caption: string,
  mediaUrl: string,
  mediaType: "IMAGE" | "REELS",
  accessToken: string,
  igUserId: string
): Promise<PublishResult> {
  const token = accessToken.trim();
  const igId = igUserId.trim();
  if (!token || !igId) {
    throw new Error("Credenciais do Instagram incompletas. Configure em Administração: token e ID do usuário Instagram.");
  }

  const createUrl = mediaType === "REELS"
    ? `${GRAPH_API_BASE}/${igId}/media?video_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&media_type=REELS&access_token=${token}`
    : `${GRAPH_API_BASE}/${igId}/media?image_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`;

  const createRes = await fetch(createUrl, { method: "POST" });
  const createJson = (await createRes.json()) as { id?: string; error?: { message: string; code: number } };
  if (createJson.error) {
    throw new Error(createJson.error.message || "Erro ao criar container no Instagram");
  }
  const creationId = createJson.id;
  if (!creationId) {
    throw new Error("Instagram não retornou ID do container");
  }

  // Aguardar o container ficar pronto (FINISHED) antes de media_publish — evita "Media ID is not available".
  // Para imagem pode ser imediato; para Reels leva até ~90s.
  const maxWait = mediaType === "REELS" ? 90000 : 30000;
  const step = mediaType === "REELS" ? 3000 : 1500;
  let elapsed = 0;
  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, step));
    elapsed += step;
    const statusRes = await fetch(
      `${GRAPH_API_BASE}/${creationId}?fields=status_code,status&access_token=${token}`
    );
    const statusJson = (await statusRes.json()) as {
      status_code?: string;
      status?: string;
      error?: { message?: string };
    };
    if (statusJson.status_code === "FINISHED") break;
    // Para imagem às vezes a API não retorna status_code; após um tempo assumir pronto.
    if (mediaType === "IMAGE" && statusJson.status_code === undefined && elapsed >= 3000) break;
    if (statusJson.status_code === "ERROR" || statusJson.status === "ERROR") {
      const detail =
        statusJson.error?.message ||
        (statusJson as { error_message?: string }).error_message ||
        "Mídia rejeitada ou URL inacessível. Confira se a URL é pública e o formato (imagem JPEG, Reels MP4).";
      throw new Error(`Processamento falhou no Instagram: ${detail}`);
    }
  }
  if (elapsed >= maxWait) {
    throw new Error(
      `Timeout aguardando container no Instagram (${mediaType === "REELS" ? "90" : "30"}s). Tente novamente ou verifique a URL da mídia.`
    );
  }

  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${igId}/media_publish?creation_id=${creationId}&access_token=${token}`,
    { method: "POST" }
  );
  const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (publishJson.error) {
    throw new Error(publishJson.error.message || "Erro ao publicar no Instagram");
  }
  const idMedia = publishJson.id;
  if (!idMedia) {
    throw new Error("Instagram não retornou ID da mídia publicada");
  }

  // Obter permalink do post (opcional)
  let linkPost: string | null = null;
  try {
    const permRes = await fetch(
      `${GRAPH_API_BASE}/${idMedia}?fields=permalink&access_token=${token}`
    );
    const permJson = (await permRes.json()) as { permalink?: string };
    linkPost = permJson.permalink ?? null;
  } catch {
    // ignora
  }

  return {
    id_container: creationId,
    id_media: idMedia,
    link_post: linkPost,
  };
}
