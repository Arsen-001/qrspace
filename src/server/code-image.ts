// Рисунок кода на сервере (SVG или PNG) — для приложений (/api/codes/[id]/image) и картинки NFT (/api/nft/[token]/image).
import { linkOf, type CodeRecord } from "@/lib/codes";
import { buildDrawing, toSvg } from "@/lib/qr/render";
import { DEFAULT_STYLE, fromSaved, toQrStyle } from "@/lib/qr/style";
import { media } from "./media";

/** SVG кода: картинки оформления (логотип, фото) — прямо внутри файла. Текстуру фона рисует браузер — здесь ровный цвет. */
export async function codeSvg(code: CodeRecord, base: string, size: number): Promise<string> {
  const style = code.style ? fromSaved({ ...code.style, texture: null }) : DEFAULT_STYLE;
  let svg = toSvg(buildDrawing(linkOf(base, code), toQrStyle(style)), size);
  // /api/asset/<отпечаток> → data:… (картинки оформления неизменны: по отпечатку содержимого).
  const assets = [...new Set(svg.match(/\/api\/asset\/[0-9a-f]{32}\.(?:png|jpg|webp)/g) ?? [])];
  for (const path of assets) {
    const name = path.slice("/api/asset/".length);
    const f = await media.open(`asset_${name}`);
    if (!f) continue;
    const bytes = Buffer.from(await new Response(f.body).arrayBuffer());
    const type = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
    svg = svg.split(`"${path}"`).join(`"data:${type};base64,${bytes.toString("base64")}"`);
  }
  return svg;
}

/** PNG из SVG; sharp ставится вместе с Next (картинки сайта) — нет его, null (тогда отдают SVG). */
export async function svgToPng(svg: string, size: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const sharp = (await import("sharp").catch(() => null))?.default;
  if (!sharp) return null;
  return new Uint8Array(await sharp(Buffer.from(svg), { density: 144 }).resize(size, size, { fit: "contain", background: "#ffffff00" }).png().toBuffer());
}
