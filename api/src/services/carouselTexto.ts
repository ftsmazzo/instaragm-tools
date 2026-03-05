import sharp from "sharp";
import { GoogleGenAI, RawReferenceImage } from "@google/genai";
import { uploadMedia, isStorageConfigured } from "./storage.js";
import { toInstagramFeedImage } from "./instagramImage.js";

const INSTAGRAM_MAX_SIDE = 1080;
const FONT_SIZE = 52;
const BAR_HEIGHT = 88;
const FILL = "#ffffff";
const BAR_FILL = "rgba(0,0,0,0.65)";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
const USE_GEMINI_FOR_TEXT = (process.env.POSTADOR_CAROUSEL_TEXTO_IA ?? "").toLowerCase() === "gemini";
const GEMINI_EDIT_MODEL = process.env.POSTADOR_CAROUSEL_TEXTO_IA_MODEL ?? "imagen-3.0-capability-001";

/**
 * Tenta adicionar texto na imagem usando Gemini/Imagen editImage (Nano Banana). Retorna null se falhar ou não configurado.
 */
async function addTextWithGemini(imageBuffer: Buffer, text: string): Promise<Buffer | null> {
  if (!GEMINI_API_KEY?.trim() || !USE_GEMINI_FOR_TEXT) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
    const rawRef = new RawReferenceImage();
    rawRef.referenceImage = {
      imageBytes: imageBuffer.toString("base64"),
      mimeType: "image/jpeg",
    };
    const prompt = `Add the following text at the bottom of the image, centered, on a semi-transparent dark bar for readability. Keep the rest of the image unchanged. Do not alter the image content. Text to add: "${text.replace(/"/g, '\\"')}"`;
    const response = await ai.models.editImage({
      model: GEMINI_EDIT_MODEL,
      prompt,
      referenceImages: [rawRef],
      config: { numberOfImages: 1 },
    });
    const out = response?.generatedImages?.[0]?.image?.imageBytes;
    if (!out) return null;
    return Buffer.from(out, "base64");
  } catch {
    return null;
  }
}

/**
 * Baixa imagem, redimensiona para formato Instagram (aspect 4:5–1,91:1), adiciona texto na parte inferior
 * (Gemini/Imagen se configurado, senão Sharp) e faz upload.
 */
async function addTextToImage(imageUrl: string, text: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Configure um armazenamento (Cloudinary, local ou MinIO) para salvar as imagens com texto.");
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const baseResized = await toInstagramFeedImage(inputBuffer);

  const geminiResult = await addTextWithGemini(baseResized, text);
  if (geminiResult && geminiResult.length > 0) {
    return uploadMedia(geminiResult, "image/jpeg", ".jpg");
  }

  const actual = await sharp(baseResized).metadata();
  const width = actual.width ?? INSTAGRAM_MAX_SIDE;
  const height = actual.height ?? INSTAGRAM_MAX_SIDE;

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

  const withOverlay = await sharp(baseResized)
    .composite([{ input: rasterized, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();

  return uploadMedia(withOverlay, "image/jpeg", ".jpg");
}

/**
 * Para cada URL de imagem, adiciona o texto correspondente (Gemini/Imagen se POSTADOR_CAROUSEL_TEXTO_IA=gemini, senão Sharp) e faz upload.
 * Retorna array de novas URLs na mesma ordem.
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
