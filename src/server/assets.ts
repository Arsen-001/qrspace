// Картинки оформления (фото в коде, логотип, значок в углах, логотип заказа) — не в данных, а в хранилище файлов:
// иначе данные раздуваются (фото-код — ~120 КБ) и каждое сохранение медленное. Имя файла — отпечаток содержимого
// (sha-256): одна и та же картинка хранится один раз, а адрес нельзя угадать.
import { createHash } from "node:crypto";
import type { SavedStyle } from "@/lib/qr/style";
import { media } from "./media";

const EXT: Record<string, string> = { png: "png", jpeg: "jpg", webp: "webp" };
export const ASSET_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** data:image/…;base64 → /api/asset/<sha>.<ext>; уже ссылка — как есть. */
export async function storeImage(src: string): Promise<string> {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(src);
  if (!m) return src;
  const bytes = Buffer.from(m[2], "base64");
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${EXT[m[1]]}`;
  if (!(await media.open(`asset_${name}`, { start: 0, end: 0 }))) await media.put(`asset_${name}`, bytes, `image/${m[1]}`);
  return `/api/asset/${name}`;
}

export async function storeStyleAssets(s: SavedStyle): Promise<SavedStyle> {
  return {
    ...s,
    logo: s.logo && { ...s.logo, src: await storeImage(s.logo.src) },
    eyeIcon: s.eyeIcon && { ...s.eyeIcon, preview: await storeImage(s.eyeIcon.preview) },
    picture: s.picture && { ...s.picture, src: await storeImage(s.picture.src) },
  };
}
