import OpenAI from "openai";
import { uploadBuffer } from "./cloudinary.js";
import { isCloudinaryConfigured } from "./cloudinary.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function getOpenAI(): OpenAI {
  if (!OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY não configurada. Necessária para gerar imagem com IA.");
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY.trim() });
}

/**
 * Gera uma imagem com DALL-E 3 a partir do prompt e faz upload no Cloudinary.
 * Retorna a URL pública da imagem (requer Cloudinary configurado).
 */
export async function gerarImagemComIA(prompt: string): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary não configurada. Configure CLOUDINARY_CLOUD_NAME (e preset) para salvar a imagem gerada.");
  }
  const openai = getOpenAI();
  const res = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt.slice(0, 4000),
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "b64_json",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("DALL-E não retornou imagem.");
  }
  const buffer = Buffer.from(b64, "base64");
  const url = await uploadBuffer(buffer, "image/png", ".png");
  return url;
}
