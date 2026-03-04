import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const CRONOGRAMA_PATH = join(DATA_DIR, "cronograma.json");

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

async function ensureCronogramaFile(): Promise<CronogramaItem[]> {
  try {
    const raw = await readFile(CRONOGRAMA_PATH, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function listCronograma(): Promise<CronogramaItem[]> {
  const list = await ensureCronogramaFile();
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function appendCronograma(item: Omit<CronogramaItem, "id" | "created_at">): Promise<CronogramaItem> {
  await mkdir(DATA_DIR, { recursive: true });
  const list = await ensureCronogramaFile();
  const created_at = new Date().toISOString();
  const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const full: CronogramaItem = {
    id,
    caption: item.caption,
    media_url: item.media_url ?? null,
    media_type: item.media_type ?? null,
    id_container: item.id_container ?? null,
    link_post: item.link_post ?? null,
    data_post: item.data_post,
    created_at,
  };
  list.unshift(full);
  await writeFile(CRONOGRAMA_PATH, JSON.stringify(list, null, 2), "utf-8");
  return full;
}
