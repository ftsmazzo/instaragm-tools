import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { isDbConfigured, getPool, ensureTables } from "../db/index.js";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIR, "config.json");

export type ConfigStore = {
  instagram: { access_token?: string; ig_user_id?: string };
  empresa: { nome: string };
};

const defaultConfig: ConfigStore = {
  instagram: {},
  empresa: { nome: "" },
};

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function loadFromFile(): Promise<ConfigStore> {
  await ensureDataDir();
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ConfigStore>;
    return {
      instagram: { ...defaultConfig.instagram, ...parsed.instagram },
      empresa: { ...defaultConfig.empresa, ...parsed.empresa },
    };
  } catch {
    return { ...defaultConfig };
  }
}

async function loadFromDb(): Promise<ConfigStore> {
  await ensureTables();
  const pool = getPool();
  const res = await pool.query<{ value: unknown }>("SELECT value FROM app_config WHERE key = $1", ["config"]);
  if (res.rows.length === 0) return { ...defaultConfig };
  const row = res.rows[0].value as Partial<ConfigStore>;
  return {
    instagram: { ...defaultConfig.instagram, ...row?.instagram },
    empresa: { ...defaultConfig.empresa, ...row?.empresa },
  };
}

export async function loadConfig(): Promise<ConfigStore> {
  if (isDbConfigured()) return loadFromDb();
  return loadFromFile();
}

async function saveToFile(config: ConfigStore): Promise<ConfigStore> {
  await ensureDataDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

async function saveToDb(config: ConfigStore): Promise<ConfigStore> {
  await ensureTables();
  const pool = getPool();
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ('config', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(config)]
  );
  return config;
}

export async function saveConfig(config: Partial<ConfigStore>): Promise<ConfigStore> {
  const current = await loadConfig();
  const next: ConfigStore = {
    instagram: { ...current.instagram, ...config.instagram },
    empresa: { ...current.empresa, ...config.empresa },
  };
  if (isDbConfigured()) return saveToDb(next);
  return saveToFile(next);
}
