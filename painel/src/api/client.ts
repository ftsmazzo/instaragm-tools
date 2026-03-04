const getBaseUrl = () => import.meta.env.VITE_API_URL?.trim() || "http://localhost:3000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...init } = options;
  const url = `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const fetchBody: BodyInit | undefined =
    body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;
  const res = await fetch(url, {
    ...init,
    headers,
    body: fetchBody,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<{ ok: boolean }>("/health"),

  postador: {
    gerarCaption: (descricao: string) =>
      request<{ caption: string; media_url?: string; media_type?: string }>(
        "/api/postador/gerar-caption",
        { method: "POST", body: { descricao } }
      ),
    refazerCaption: (caption_atual: string, feedback: string, refazer_midia?: boolean) =>
      request<{ caption: string; media_url?: string; media_type?: string }>(
        "/api/postador/refazer-caption",
        { method: "POST", body: { caption_atual, feedback, refazer_midia } }
      ),
    publicar: (caption: string, media_url?: string, media_type?: string) =>
      request<{ ok: boolean; id_container?: string; message?: string }>(
        "/api/postador/publicar",
        { method: "POST", body: { caption, media_url, media_type } }
      ),
  },
};
