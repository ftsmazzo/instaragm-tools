const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL;
  if (url) return (url as string).trim().replace(/\/$/, "");
  return "http://localhost:3000";
};

const base = getBaseUrl();

type FetchOptions = Omit<RequestInit, "body"> & { body?: Record<string, unknown> };

async function fetchJson<T>(path: string, options?: FetchOptions): Promise<T> {
  const { body, ...init } = options ?? {};
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export type Health = { status: string; timestamp: string };
export type Config = {
  instagram: { connected: boolean; ig_user_id?: string; access_token?: string };
  empresa: { nome: string };
};

export type CronogramaItem = {
  id: string;
  caption: string;
  media_url: string | null;
  media_type: "IMAGE" | "REELS" | null;
  id_container: string | null;
  link_post: string | null;
  data_post: string;
  created_at: string;
};

export type Postagem = {
  id?: number;
  id_post?: string;
  caption_post?: string;
  media_type?: string;
  media_url?: string;
  link_post?: string;
  data_post?: string;
  media_description?: string;
  hashtags?: string | null;
  mencoes?: string | null;
  processado?: boolean;
  processado_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PostagensResponse = {
  postagens: Postagem[];
  total: number;
};

export type RasparResponse = PostagensResponse & { triggered: boolean };

export const api = {
  getHealth: () => fetchJson<Health>("/health"),
  getConfig: () => fetchJson<Config>("/api/config"),
  putConfig: (body: Config) =>
    fetchJson<{ saved: boolean; received: Config }>("/api/config", {
      method: "PUT",
      body,
    }),
  getPostagens: () => fetchJson<PostagensResponse>("/api/postagens"),
  rasparPostagens: () =>
    fetchJson<RasparResponse>("/api/postagens/raspar", {
      method: "POST",
      body: {},
    }),
  postador: {
    gerarCaption: (
      descricao: string,
      file?: File | null,
      provider?: string | null,
      model?: string | null
    ) => {
      if (file) {
        const form = new FormData();
        form.set("descricao", descricao);
        form.set("arquivo", file);
        if (provider) form.set("provider", provider);
        if (model) form.set("model", model);
        return fetch(`${base}/api/postador/gerar-caption`, {
          method: "POST",
          body: form,
        }).then((res) => {
          if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
          return res.json() as Promise<{ caption: string; media_url?: string; media_type?: string }>;
        });
      }
      return fetchJson<{ caption: string; media_url?: string; media_type?: string }>("/api/postador/gerar-caption", {
        method: "POST",
        body: { descricao, provider: provider || undefined, model: model || undefined },
      });
    },
    refazerCaption: (
      caption_atual: string,
      feedback: string,
      refazer_midia?: boolean,
      provider?: string | null,
      model?: string | null
    ) =>
      fetchJson<{ caption: string; media_url?: string; media_type?: string }>("/api/postador/refazer-caption", {
        method: "POST",
        body: { caption_atual, feedback, refazer_midia, provider: provider || undefined, model: model || undefined },
      }),
    publicar: (caption: string, media_url?: string, media_type?: string) =>
      fetchJson<{ ok: boolean; id_container?: string; id_media?: string; link_post?: string; message?: string }>("/api/postador/publicar", {
        method: "POST",
        body: { caption, media_url, media_type },
      }),
    getCronograma: () =>
      fetchJson<{ cronograma: CronogramaItem[]; total: number }>("/api/postador/cronograma"),
  },
};
