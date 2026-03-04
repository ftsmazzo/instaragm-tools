/**
 * Upload de mídia para Cloudinary (URLs públicas e estáveis, como no workflow n8n do Postador).
 * Usa o mesmo cloud e preset da automação: cloud_name + upload_preset (ex.: n8nimage).
 */
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET ?? "n8nimage";

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME.trim());
}

/**
 * Faz upload de um buffer para o Cloudinary (auto: imagem ou vídeo) e retorna a URL pública (secure_url).
 */
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  extension: string
): Promise<string> {
  const cloudName = CLOUDINARY_CLOUD_NAME.trim();
  if (!cloudName) {
    throw new Error("CLOUDINARY_CLOUD_NAME não configurada.");
  }
  const preset = CLOUDINARY_UPLOAD_PRESET.trim() || "n8nimage";
  const filename = `postador-${Date.now()}${extension}`;

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  form.append("upload_preset", preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? "Erro ao fazer upload no Cloudinary");
  }
  const url = json.secure_url;
  if (!url) {
    throw new Error("Cloudinary não retornou URL da mídia");
  }
  return url;
}
