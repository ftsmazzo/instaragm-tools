/**
 * Redimensiona e recorta imagens para o feed do Instagram.
 * Aspect ratio aceito: entre 4:5 (0,8) e 1,91:1 (documentação Meta).
 */
import sharp from "sharp";

const MAX_SIDE = 1080;
/** Instagram feed: mínimo width/height = 4:5 = 0.8 */
const MIN_RATIO = 4 / 5;
/** Instagram feed: máximo width/height = 1.91:1 */
const MAX_RATIO = 1.91;

/**
 * Redimensiona (lado máximo 1080) e, se necessário, recorta para aspect ratio entre 4:5 e 1,91:1.
 * Retorna JPEG pronto para o feed.
 */
export async function toInstagramFeedImage(buffer: Buffer): Promise<Buffer> {
  const resized = await sharp(buffer)
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", position: "centre", withoutEnlargement: true })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const aw = meta.width ?? MAX_SIDE;
  const ah = meta.height ?? MAX_SIDE;
  const ratio = aw / ah;

  let extract: { left: number; top: number; width: number; height: number } | null = null;
  if (ratio < MIN_RATIO) {
    const outH = Math.round(aw / MIN_RATIO);
    const top = Math.max(0, Math.round((ah - outH) / 2));
    extract = { left: 0, top, width: aw, height: Math.min(outH, ah - top) };
  } else if (ratio > MAX_RATIO) {
    const outW = Math.round(ah * MAX_RATIO);
    const left = Math.max(0, Math.round((aw - outW) / 2));
    extract = { left, top: 0, width: Math.min(outW, aw - left), height: ah };
  }

  const pipeline = extract
    ? sharp(resized).extract(extract).jpeg({ quality: 85 })
    : sharp(resized).jpeg({ quality: 85 });
  return pipeline.toBuffer();
}
