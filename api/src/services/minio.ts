import Minio from "minio";
import type { Readable } from "stream";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "";
const MINIO_PORT = parseInt(process.env.MINIO_PORT ?? "9000", 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true" || process.env.MINIO_USE_SSL === "1";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "postador";
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? ""; // ex: https://minio.seudominio.com

let client: Minio.Client | null = null;

function getClient(): Minio.Client {
  if (!MINIO_ENDPOINT.trim()) {
    throw new Error("MINIO_ENDPOINT não configurado. Defina as variáveis de ambiente MinIO na API.");
  }
  if (!client) {
    const [host] = MINIO_ENDPOINT.split(":");
    client = new Minio.Client({
      endPoint: host.trim(),
      port: MINIO_ENDPOINT.includes(":") ? parseInt(MINIO_ENDPOINT.split(":")[1], 10) : MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY.trim(),
      secretKey: MINIO_SECRET_KEY.trim(),
    });
  }
  return client;
}

function getPublicUrl(objectName: string): string {
  if (MINIO_PUBLIC_URL) {
    const base = MINIO_PUBLIC_URL.replace(/\/$/, "");
    return `${base}/${MINIO_BUCKET}/${objectName}`;
  }
  const proto = MINIO_USE_SSL ? "https" : "http";
  const host = MINIO_ENDPOINT.includes(":") ? MINIO_ENDPOINT : `${MINIO_ENDPOINT}:${MINIO_PORT}`;
  return `${proto}://${host}/${MINIO_BUCKET}/${objectName}`;
}

export function isMinioConfigured(): boolean {
  return Boolean(
    MINIO_ENDPOINT?.trim() && MINIO_ACCESS_KEY?.trim() && MINIO_SECRET_KEY?.trim()
  );
}

/**
 * Garante que o bucket existe (cria se não existir).
 */
async function ensureBucket(): Promise<void> {
  const c = getClient();
  const exists = await c.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await c.makeBucket(MINIO_BUCKET, "us-east-1");
  }
}

/**
 * Faz upload de um stream para o MinIO e retorna a URL pública do objeto.
 */
export async function uploadStream(
  stream: Readable,
  contentType: string,
  extension: string
): Promise<string> {
  await ensureBucket();
  const key = `postador/${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extension}`;
  const c = getClient();
  await c.putObject(MINIO_BUCKET, key, stream, undefined, {
    "Content-Type": contentType,
  });
  return getPublicUrl(key);
}
