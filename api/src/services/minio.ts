import * as MinioNamespace from "minio";
import type { Readable } from "stream";

// Em ESM o pacote minio pode não expor default; usar namespace ou default conforme o runtime
const Minio = (MinioNamespace as unknown as { default?: typeof MinioNamespace }).default ?? MinioNamespace;

// Suporta tanto as variáveis do Postador quanto as do CRM (MINIO_SERVER_URL, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD)
const MINIO_SERVER_URL = process.env.MINIO_SERVER_URL ?? "";
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "";
const MINIO_PORT = parseInt(process.env.MINIO_PORT ?? "9000", 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true" || process.env.MINIO_USE_SSL === "1";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "crm";
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? "";

let client: InstanceType<typeof Minio.Client> | null = null;

function parseServerUrl(url: string): { endPoint: string; port: number; useSSL: boolean } {
  const u = new URL(url.startsWith("http") ? url : `https://${url}`);
  return {
    endPoint: u.hostname,
    port: u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80,
    useSSL: u.protocol === "https:",
  };
}

function getClient(): InstanceType<typeof Minio.Client> {
  const accessKey = MINIO_ACCESS_KEY.trim();
  const secretKey = MINIO_SECRET_KEY.trim();
  if (!accessKey || !secretKey) {
    throw new Error("MinIO: defina MINIO_ACCESS_KEY e MINIO_SECRET_KEY (ou MINIO_ROOT_USER e MINIO_ROOT_PASSWORD).");
  }
  if (!client) {
    if (MINIO_SERVER_URL.trim()) {
      const { endPoint, port, useSSL } = parseServerUrl(MINIO_SERVER_URL.trim());
      client = new Minio.Client({
        endPoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });
    } else if (MINIO_ENDPOINT.trim()) {
      const [host] = MINIO_ENDPOINT.split(":");
      client = new Minio.Client({
        endPoint: host.trim(),
        port: MINIO_ENDPOINT.includes(":") ? parseInt(MINIO_ENDPOINT.split(":")[1], 10) : MINIO_PORT,
        useSSL: MINIO_USE_SSL,
        accessKey,
        secretKey,
      });
    } else {
      throw new Error("MinIO: defina MINIO_SERVER_URL (ex.: https://cmr-imobiliaria-minio.90qhxz.easypanel.host) ou MINIO_ENDPOINT.");
    }
  }
  return client;
}

function getPublicUrl(objectName: string): string {
  const base = (MINIO_PUBLIC_URL || MINIO_SERVER_URL).trim().replace(/\/$/, "");
  if (base) {
    return `${base}/${MINIO_BUCKET}/${objectName}`;
  }
  const proto = MINIO_USE_SSL ? "https" : "http";
  const host = MINIO_ENDPOINT.includes(":") ? MINIO_ENDPOINT : `${MINIO_ENDPOINT}:${MINIO_PORT}`;
  return `${proto}://${host}/${MINIO_BUCKET}/${objectName}`;
}

export function isMinioConfigured(): boolean {
  const accessKey = (MINIO_ACCESS_KEY || (process.env.MINIO_ROOT_USER ?? "")).trim();
  const secretKey = (MINIO_SECRET_KEY || (process.env.MINIO_ROOT_PASSWORD ?? "")).trim();
  const hasUrl = MINIO_SERVER_URL.trim() || MINIO_ENDPOINT.trim();
  return Boolean(hasUrl && accessKey && secretKey);
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
 * Os objetos do Postador ficam sob o prefixo postador/ no bucket (ex.: crm/postador/xxx.jpg).
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
