import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

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

export async function loadConfig(): Promise<ConfigStore> {
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

export async function saveConfig(config: Partial<ConfigStore>): Promise<ConfigStore> {
  await ensureDataDir();
  const current = await loadConfig();
  const next: ConfigStore = {
    instagram: { ...current.instagram, ...config.instagram },
    empresa: { ...current.empresa, ...config.empresa },
  };
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
