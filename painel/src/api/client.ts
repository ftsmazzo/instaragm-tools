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

export type PostagensResponse = {
  postagens: unknown[];
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
