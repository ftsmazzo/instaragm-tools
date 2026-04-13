const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

const FORM = "application/x-www-form-urlencoded";

function graphGet(path: string, token: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${GRAPH_API_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`;
}

export type PublishResult = {
  id_container: string;
  id_media: string;
  link_post: string | null;
};

/**
 * Cria um container de mídia (imagem ou Reels) e publica no Instagram.
 * Requer token e ig_user_id da conta profissional vinculada à página.
 * access_token vai no corpo POST (form) para não quebrar tokens com &, =, etc. na query string.
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

  const createParams = new URLSearchParams();
  createParams.set("caption", caption);
  createParams.set("access_token", token);
  if (mediaType === "REELS") {
    createParams.set("video_url", mediaUrl);
    createParams.set("media_type", "REELS");
  } else {
    createParams.set("image_url", mediaUrl);
  }

  const createRes = await fetch(`${GRAPH_API_BASE}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": FORM },
    body: createParams.toString(),
  });
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
    const statusRes = await fetch(graphGet(`/${creationId}?fields=status_code,status`, token));
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

  const publishParams = new URLSearchParams();
  publishParams.set("creation_id", creationId);
  publishParams.set("access_token", token);
  const publishRes = await fetch(`${GRAPH_API_BASE}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": FORM },
    body: publishParams.toString(),
  });
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
    const permRes = await fetch(graphGet(`/${idMedia}?fields=permalink`, token));
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

async function waitContainerReady(creationId: string, token: string, maxWaitMs = 30000): Promise<void> {
  const step = 1500;
  let elapsed = 0;
  while (elapsed < maxWaitMs) {
    await new Promise((r) => setTimeout(r, step));
    elapsed += step;
    const statusRes = await fetch(graphGet(`/${creationId}?fields=status_code,status`, token));
    const statusJson = (await statusRes.json()) as { status_code?: string; status?: string; error?: { message?: string } };
    if (statusJson.status_code === "FINISHED") return;
    if (statusJson.status_code === "ERROR" || statusJson.status === "ERROR") {
      const detail = statusJson.error?.message ?? "URL inacessível ou formato inválido.";
      throw new Error(`Processamento do item falhou no Instagram: ${detail}`);
    }
    if (elapsed >= 6000 && statusJson.status_code === undefined) return; // imagem pode não devolver status
  }
  throw new Error("Timeout aguardando container no Instagram.");
}

/**
 * Publica um carrossel (várias imagens) no Instagram.
 * Cria um container por imagem com is_carousel_item=true, depois o container pai CAROUSEL.
 */
export async function publishCarouselToInstagram(
  caption: string,
  mediaUrls: string[],
  accessToken: string,
  igUserId: string
): Promise<PublishResult> {
  const token = accessToken.trim();
  const igId = igUserId.trim();
  if (!token || !igId) {
    throw new Error("Credenciais do Instagram incompletas. Configure em Administração: token e ID do usuário Instagram.");
  }
  if (!mediaUrls.length || mediaUrls.length > 10) {
    throw new Error("Carrossel deve ter entre 1 e 10 imagens.");
  }

  const childIds: string[] = [];
  for (const imageUrl of mediaUrls) {
    const childParams = new URLSearchParams();
    childParams.set("image_url", imageUrl);
    childParams.set("is_carousel_item", "true");
    childParams.set("access_token", token);
    const createRes = await fetch(`${GRAPH_API_BASE}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": FORM },
      body: childParams.toString(),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (createJson.error) {
      throw new Error(createJson.error.message || "Erro ao criar item do carrossel no Instagram");
    }
    const id = createJson.id;
    if (!id) throw new Error("Instagram não retornou ID do item do carrossel");
    childIds.push(id);
  }

  for (const childId of childIds) {
    await waitContainerReady(childId, token);
  }

  const parentParams = new URLSearchParams();
  parentParams.set("media_type", "CAROUSEL");
  parentParams.set("children", childIds.join(","));
  parentParams.set("caption", caption);
  parentParams.set("access_token", token);
  const parentRes = await fetch(`${GRAPH_API_BASE}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": FORM },
    body: parentParams.toString(),
  });
  const parentJson = (await parentRes.json()) as { id?: string; error?: { message: string } };
  if (parentJson.error) {
    throw new Error(parentJson.error.message || "Erro ao criar carrossel no Instagram");
  }
  const parentId = parentJson.id;
  if (!parentId) throw new Error("Instagram não retornou ID do carrossel");

  await waitContainerReady(parentId, token, 60000);

  const carouselPublishParams = new URLSearchParams();
  carouselPublishParams.set("creation_id", parentId);
  carouselPublishParams.set("access_token", token);
  const publishRes = await fetch(`${GRAPH_API_BASE}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": FORM },
    body: carouselPublishParams.toString(),
  });
  const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (publishJson.error) {
    throw new Error(publishJson.error.message || "Erro ao publicar carrossel no Instagram");
  }
  const idMedia = publishJson.id;
  if (!idMedia) throw new Error("Instagram não retornou ID da mídia publicada");

  let linkPost: string | null = null;
  try {
    const permRes = await fetch(graphGet(`/${idMedia}?fields=permalink`, token));
    const permJson = (await permRes.json()) as { permalink?: string };
    linkPost = permJson.permalink ?? null;
  } catch {
    // ignora
  }

  return {
    id_container: parentId,
    id_media: idMedia,
    link_post: linkPost,
  };
}
