import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";

const FONT_SIZE = 52;
const BAR_HEIGHT = 88;
const MAX_IMAGE_SIDE = 1440;
const FILL = "#ffffff";
const BAR_FILL = "rgba(0,0,0,0.65)";

/**
 * Baixa imagem de uma URL e adiciona texto (overlay SVG) na parte inferior,
 * com barra semi-transparente para legibilidade. Faz upload no Cloudinary.
 */
async function addTextToImage(imageUrl: string, text: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Configure um armazenamento (Cloudinary, local ou MinIO) para salvar as imagens com texto.");
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  const meta = await sharp(inputBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const safeText = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const barTop = height - BAR_HEIGHT;
  const textY = height - BAR_HEIGHT / 2 + FONT_SIZE / 3;
  const textX = width / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="${barTop}" width="${width}" height="${BAR_HEIGHT}" fill="${BAR_FILL}"/>
  <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="${FILL}">${safeText}</text>
</svg>`;

  const overlayBuffer = Buffer.from(svg);
  const rasterized = await sharp(overlayBuffer)
    .resize(width, height)
    .toBuffer();

  const output = await sharp(inputBuffer)
    .composite([{ input: rasterized, top: 0, left: 0 }])
    .resize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return uploadMedia(output, "image/jpeg", ".jpg");
}

/**
 * Para cada URL de imagem, adiciona o texto correspondente e faz upload no Cloudinary.
 * Retorna array de novas URLs na mesma ordem.
 * texts[i] é o texto da i-ésima imagem; se texts for menor que imageUrls, as restantes ficam sem texto.
 */
export async function adicionarTextoCarrossel(
  imageUrls: string[],
  texts: string[]
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const text = texts[i]?.trim() ?? "";
    if (!text) {
      results.push(url);
      continue;
    }
    const newUrl = await addTextToImage(url, text);
    results.push(newUrl);
  }
  return results;
}
