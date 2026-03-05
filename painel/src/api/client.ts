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
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = (errBody as { error?: string }).error ?? `API ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export type Health = { status: string; timestamp: string };

export type ContaInstagramRes = {
  id: string;
  nome: string;
  ig_user_id: string;
  has_token: boolean;
};

export type Config = {
  empresa: { nome: string };
  contas_instagram: ContaInstagramRes[];
  instagram_default_id: string | null;
  instagram?: { connected: boolean; ig_user_id?: string };
};

export type ContaInstagramInput = {
  id?: string;
  nome: string;
  ig_user_id: string;
  access_token?: string;
};

export type CronogramaItem = {
  id: string;
  caption: string;
  media_url: string | null;
  media_type: "IMAGE" | "REELS" | "CAROUSEL" | null;
  id_container: string | null;
  link_post: string | null;
  data_post: string;
  created_at: string;
};

export type AgendadoItem = {
  id: string;
  caption: string;
  media_url: string | null;
  media_urls: string[] | null;
  media_type: "IMAGE" | "REELS" | "CAROUSEL";
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
  putConfig: (body: {
    empresa?: { nome: string };
    contas_instagram?: ContaInstagramInput[];
    instagram_default_id?: string | null;
    instagram?: { access_token?: string; ig_user_id?: string };
  }) =>
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
      file?: File | File[] | null,
      provider?: string | null,
      model?: string | null
    ) => {
      const files = file == null ? [] : Array.isArray(file) ? file : [file];
      if (files.length > 0) {
        const form = new FormData();
        form.set("descricao", descricao);
        for (const f of files) form.append("arquivo", f);
        if (provider) form.set("provider", provider);
        if (model) form.set("model", model);
        return fetch(`${base}/api/postador/gerar-caption`, {
          method: "POST",
          body: form,
        }).then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = (errBody as { error?: string }).error ?? `API ${res.status}: ${res.statusText}`;
            throw new Error(msg);
          }
          return res.json() as Promise<{ caption: string; media_url?: string; media_urls?: string[]; media_type?: string }>;
        });
      }
      return fetchJson<{ caption: string; media_url?: string; media_urls?: string[]; media_type?: string }>("/api/postador/gerar-caption", {
        method: "POST",
        body: { descricao, provider: provider || undefined, model: model || undefined },
      });
    },
    gerarPorUrl: (url: string, provider?: string | null, model?: string | null) =>
      fetchJson<{ caption: string; media_url?: string; media_type?: string }>("/api/postador/por-url", {
        method: "POST",
        body: { url, provider: provider || undefined, model: model || undefined },
      }),
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
    publicar: (payload: {
      caption: string;
      media_url?: string;
      media_urls?: string[];
      media_type?: "IMAGE" | "REELS";
      conta_id?: string | null;
    }) =>
      fetchJson<{ ok: boolean; id_container?: string; id_media?: string; link_post?: string; message?: string }>("/api/postador/publicar", {
        method: "POST",
        body: payload,
      }),
    getCronograma: () =>
      fetchJson<{ cronograma: CronogramaItem[]; total: number }>("/api/postador/cronograma"),
    getAgendados: () =>
      fetchJson<{ agendados: AgendadoItem[]; total: number }>("/api/postador/agendados"),
    saveAgendado: (payload: {
      caption: string;
      media_url?: string | null;
      media_urls?: string[] | null;
      media_type: "IMAGE" | "REELS" | "CAROUSEL";
    }) =>
      fetchJson<{ ok: boolean; agendado: AgendadoItem }>("/api/postador/agendados", {
        method: "POST",
        body: payload,
      }),
    deleteAgendado: (id: string) =>
      fetchJson<{ ok: boolean }>(`/api/postador/agendados/${id}`, { method: "DELETE" }),
    publicarAgendado: (id: string, conta_id?: string | null) =>
      fetchJson<{ ok: boolean; id_container?: string; id_media?: string; link_post?: string; message?: string }>(
        `/api/postador/agendados/${id}/publicar`,
        { method: "POST", body: { conta_id: conta_id ?? undefined } }
      ),
    gerarImagem: (prompt: string, provider?: "openai" | "gemini") =>
      fetchJson<{ media_url: string }>("/api/postador/gerar-imagem", {
        method: "POST",
        body: { prompt, provider: provider ?? "openai" },
      }),
    carouselAdicionarTexto: (image_urls: string[], texts: string[]) =>
      fetchJson<{ image_urls: string[] }>("/api/postador/carousel-adicionar-texto", {
        method: "POST",
        body: { image_urls, texts },
      }),
    uploadMidia: (file: File) => {
      const form = new FormData();
      form.set("arquivo", file);
      return fetch(`${base}/api/postador/upload-midia`, { method: "POST", body: form }).then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = (errBody as { error?: string }).error ?? `API ${res.status}: ${res.statusText}`;
          throw new Error(msg);
        }
        return res.json() as Promise<{ media_url: string }>;
      });
    },
  },
};
