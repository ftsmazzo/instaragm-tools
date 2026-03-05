import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { isDbConfigured, getPool, ensureTables } from "../db/index.js";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIR, "config.json");

export type ContaInstagram = {
  id: string;
  nome: string;
  access_token: string;
  ig_user_id: string;
};

export type ConfigStore = {
  empresa: { nome: string };
  /** Múltiplas contas Instagram para postar. */
  contas_instagram: ContaInstagram[];
  /** ID da conta usada por padrão ao publicar (quando o painel não envia conta_id). */
  instagram_default_id: string | null;
  /** @deprecated Use contas_instagram; mantido para migração. */
  instagram?: { access_token?: string; ig_user_id?: string };
};

const defaultConfig: ConfigStore = {
  empresa: { nome: "" },
  contas_instagram: [],
  instagram_default_id: null,
};

function genContaId(): string {
  return `conta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Migra config antiga (um único instagram) para contas_instagram. */
function normalizeConfig(parsed: Partial<ConfigStore>): ConfigStore {
  const contas = Array.isArray(parsed.contas_instagram) ? [...parsed.contas_instagram] : [];
  const defaultId = parsed.instagram_default_id ?? null;

  if (contas.length === 0 && parsed.instagram?.access_token?.trim() && parsed.instagram?.ig_user_id?.trim()) {
    contas.push({
      id: genContaId(),
      nome: "Conta principal",
      access_token: parsed.instagram.access_token.trim(),
      ig_user_id: parsed.instagram.ig_user_id.trim(),
    });
  }

  return {
    empresa: { ...defaultConfig.empresa, ...parsed.empresa },
    contas_instagram: contas,
    instagram_default_id: defaultId ?? (contas[0]?.id ?? null),
    instagram: parsed.instagram,
  };
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function loadFromFile(): Promise<ConfigStore> {
  await ensureDataDir();
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ConfigStore>;
    return normalizeConfig(parsed);
  } catch {
    return { ...defaultConfig };
  }
}

async function loadFromDb(): Promise<ConfigStore> {
  await ensureTables();
  const pool = getPool();
  const res = await pool.query<{ value: unknown }>("SELECT value FROM app_config WHERE key = $1", ["config"]);
  if (res.rows.length === 0) return { ...defaultConfig };
  const parsed = res.rows[0].value as Partial<ConfigStore>;
  return normalizeConfig(parsed);
}

export async function loadConfig(): Promise<ConfigStore> {
  if (isDbConfigured()) return loadFromDb();
  return loadFromFile();
}

/** Retorna token e ig_user_id da conta a usar (conta_id ou padrão). Para uso interno ao publicar. */
export function getContaParaPublicar(config: ConfigStore, contaId?: string | null): { token: string; igUserId: string } | null {
  const id = (contaId ?? config.instagram_default_id)?.trim();
  const conta = id
    ? config.contas_instagram.find((c) => c.id === id)
    : config.contas_instagram[0];
  if (!conta?.access_token?.trim() || !conta?.ig_user_id?.trim()) return null;
  return { token: conta.access_token.trim(), igUserId: conta.ig_user_id.trim() };
}

async function saveToFile(config: ConfigStore): Promise<ConfigStore> {
  await ensureDataDir();
  const toSave: ConfigStore = { ...config };
  delete (toSave as Partial<ConfigStore>).instagram;
  await writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2), "utf-8");
  return config;
}

async function saveToDb(config: ConfigStore): Promise<ConfigStore> {
  await ensureTables();
  const pool = getPool();
  const toSave = { ...config } as Record<string, unknown>;
  delete toSave.instagram;
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ('config', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(toSave)]
  );
  return config;
}

export type ContaInstagramInput = {
  id?: string;
  nome: string;
  ig_user_id: string;
  access_token?: string; // se vazio, mantém o existente
};

export async function saveConfig(config: Partial<Omit<ConfigStore, "contas_instagram">> & { contas_instagram?: ContaInstagramInput[] }): Promise<ConfigStore> {
  const current = await loadConfig();
  let contas = current.contas_instagram;
  let defaultId = current.instagram_default_id;

  if (config.contas_instagram) {
    const input = config.contas_instagram;
    contas = input.map((c) => {
      const existing = c.id ? contas.find((x) => x.id === c.id) : null;
      const token = (c.access_token?.trim() || existing?.access_token) ?? "";
      return {
        id: c.id ?? genContaId(),
        nome: (c.nome ?? existing?.nome ?? "").trim() || "Conta",
        ig_user_id: (c.ig_user_id ?? existing?.ig_user_id ?? "").trim(),
        access_token: token,
      };
    });
  }

  if (config.instagram_default_id !== undefined) {
    defaultId = config.instagram_default_id?.trim() || null;
  }
  if (config.empresa?.nome !== undefined) {
    current.empresa.nome = config.empresa.nome;
  }

  const next: ConfigStore = {
    empresa: current.empresa,
    contas_instagram: contas,
    instagram_default_id: defaultId,
  };
  if (isDbConfigured()) return saveToDb(next);
  return saveToFile(next);
}
