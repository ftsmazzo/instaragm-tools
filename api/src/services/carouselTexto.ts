import sharp from "sharp";
import { uploadBuffer } from "./cloudinary.js";
import { isCloudinaryConfigured } from "./cloudinary.js";

const FONT_SIZE = 48;
const PADDING = 24;
const FILL = "#ffffff";
const STROKE = "#000000";
const STROKE_WIDTH = 2;

/**
 * Baixa imagem de uma URL e adiciona texto (overlay SVG) na parte inferior.
 * Faz upload do resultado no Cloudinary e retorna a nova URL.
 */
async function addTextToImage(imageUrl: string, text: string): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary não configurada. Necessária para salvar as imagens com texto.");
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  const meta = await sharp(inputBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const y = height - PADDING - FONT_SIZE;
  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${STROKE}" flood-opacity="0.8"/>
    </filter>
  </defs>
  <text x="${width / 2}" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${FONT_SIZE}" font-weight="bold"
        fill="${FILL}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" filter="url(#shadow)">${safeText}</text>
</svg>`;

  const overlay = Buffer.from(svg);
  const output = await sharp(inputBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const url = await uploadBuffer(output, "image/png", ".png");
  return url;
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
