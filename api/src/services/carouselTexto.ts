import sharp from "sharp";
import { uploadMedia, isStorageConfigured } from "./storage.js";

/** Lado máximo em pixels (Instagram recomenda 1080; 1440 mantém boa qualidade). */
const INSTAGRAM_MAX_SIDE = 1080;
const FONT_SIZE = 52;
const BAR_HEIGHT = 88;
const FILL = "#ffffff";
const BAR_FILL = "rgba(0,0,0,0.65)";

/**
 * Redimensiona para o formato ideal do Instagram: mantém aspect ratio,
 * lado maior = INSTAGRAM_MAX_SIDE (sem aumentar se já for menor).
 */
function dimensionsForInstagram(width: number, height: number): { w: number; h: number } {
  const scale = Math.min(INSTAGRAM_MAX_SIDE / width, INSTAGRAM_MAX_SIDE / height, 1);
  return {
    w: Math.round(width * scale),
    h: Math.round(height * scale),
  };
}

/**
 * Baixa imagem, redimensiona para formato ideal Instagram, adiciona texto (overlay) na parte inferior
 * e faz upload. Base e overlay usam sempre as mesmas dimensões para evitar erro do Sharp.
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
  const origW = meta.width ?? 1024;
  const origH = meta.height ?? 1024;

  const target = dimensionsForInstagram(origW, origH);

  const basePipeline = sharp(inputBuffer).resize(target.w, target.h, {
    fit: "inside",
    position: "centre",
  });
  const baseResized = await basePipeline.toBuffer();
  const actual = await sharp(baseResized).metadata();
  const width = actual.width ?? target.w;
  const height = actual.height ?? target.h;

  const safeText = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const barTop = Math.max(0, height - BAR_HEIGHT);
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

  const output = await sharp(baseResized)
    .composite([{ input: rasterized, top: 0, left: 0 }])
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
