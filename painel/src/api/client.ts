const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
};

const base = getBaseUrl();

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export type Health = { status: string; timestamp: string };
export type Config = {
  instagram: { connected: boolean };
  empresa: { nome: string };
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
      body: JSON.stringify(body),
    }),
  getPostagens: () => fetchJson<PostagensResponse>("/api/postagens"),
  rasparPostagens: () =>
    fetchJson<RasparResponse>("/api/postagens/raspar", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
