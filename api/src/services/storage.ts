/**
 * Armazenamento de mídia do Postador: Cloudinary (com compressão para ≤10MB),
 * armazenamento local (self-hosted) ou MinIO.
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { Readable } from "stream";
import { isCloudinaryConfigured, uploadBuffer as cloudinaryUpload } from "./cloudinary.js";
import { isMinioConfigured, uploadStream as minioUpload } from "./minio.js";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const MAX_BYTES_CLOUDINARY = 9.5 * 1024 * 1024; // 9.5 MB (limite free tier 10 MB)
const MAX_IMAGE_SIDE = 1440; // Instagram recomenda 1080–1440
const JPEG_QUALITY = 85;

const STORAGE = (process.env.POSTADOR_STORAGE ?? "cloudinary").toLowerCase();
const MEDIA_BASE_URL = (process.env.POSTADOR_MEDIA_BASE_URL ?? process.env.API_PUBLIC_URL ?? "").trim().replace(/\/$/, "");

export function isLocalStorage(): boolean {
  return STORAGE === "local" && Boolean(MEDIA_BASE_URL);
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export function isStorageConfigured(): boolean {
  return isLocalStorage() || isCloudinaryConfigured() || isMinioConfigured();
}

/**
 * Comprime imagem (buffer) para caber em ~9 MB: redimensiona e converte para JPEG.
 */
async function compressImageForCloudinary(
  buffer: Buffer,
  _contentType: string,
  _ext: string
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const out = await sharp(buffer)
    .resize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { buffer: out, contentType: "image/jpeg", ext: ".jpg" };
}

/**
 * Se for imagem e estiver acima do limite, comprime. Retorna buffer + tipo + ext para upload.
 */
async function ensureUnderLimit(
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const isImage = contentType.startsWith("image/");
  if (!isImage || buffer.length <= MAX_BYTES_CLOUDINARY) {
    return { buffer, contentType, ext };
  }
  return compressImageForCloudinary(buffer, contentType, ext);
}

/**
 * Salva buffer em data/uploads e retorna a URL pública (POSTADOR_MEDIA_BASE_URL + /api/postador/media/:filename).
 */
async function saveLocal(buffer: Buffer, contentType: string, ext: string): Promise<string> {
  if (!MEDIA_BASE_URL) {
    throw new Error("POSTADOR_MEDIA_BASE_URL (ou API_PUBLIC_URL) é obrigatório para armazenamento local. Ex.: https://sua-api.90qhxz.easypanel.host");
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const filename = `postador-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${safeExt}`;
  const path = join(UPLOADS_DIR, filename);
  await writeFile(path, buffer, "binary");
  return `${MEDIA_BASE_URL}/api/postador/media/${filename}`;
}

/**
 * Upload unificado: local, Cloudinary (com compressão se >10MB) ou MinIO.
 * Retorna URL pública da mídia.
 */
export async function uploadMedia(buffer: Buffer, contentType: string, ext: string): Promise<string> {
  if (isLocalStorage()) {
    const isImage = contentType.startsWith("image/");
    const { buffer: buf, contentType: ct, ext: e } = isImage && buffer.length > MAX_BYTES_CLOUDINARY
      ? await compressImageForCloudinary(buffer, contentType, ext)
      : { buffer, contentType, ext };
    return saveLocal(buf, ct, e);
  }

  if (isCloudinaryConfigured()) {
    const { buffer: buf, contentType: ct, ext: e } = await ensureUnderLimit(buffer, contentType, ext);
    return cloudinaryUpload(buf, ct, e);
  }

  if (isMinioConfigured()) {
    const stream = Readable.from(buffer);
    return minioUpload(stream, contentType, ext);
  }

  throw new Error("Nenhum armazenamento configurado. Defina Cloudinary (CLOUDINARY_*), MinIO (MINIO_*) ou POSTADOR_STORAGE=local com POSTADOR_MEDIA_BASE_URL.");
}
