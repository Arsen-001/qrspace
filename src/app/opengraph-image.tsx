import { ImageResponse } from "next/og";

// Превью ссылки в мессенджерах: знак, название и рисунок QR. Текст латиницей — встроенный шрифт картинки
// не знает кириллицы и армянского; название страницы мессенджер покажет сам, из заголовка.
export const alt = "QR Space";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Узор, похожий на QR: псевдослучайные клетки (всегда одинаковые) и три угла.
const N = 21;
const cell = (x: number, y: number) => {
  const corner = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
  if (corner(0, 0) || corner(N - 7, 0) || corner(0, N - 7)) {
    const lx = x < 7 ? x : x - (N - 7);
    const ly = y < 7 ? y : y - (N - 7);
    const ring = lx === 0 || ly === 0 || lx === 6 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  }
  return ((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) % 7 < 3;
};

export default function Image() {
  const S = 22;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 90px", background: "#0b0b0c" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#c6ff2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#0b0b0c", fontSize: 40, fontWeight: 800 }}>
              QR
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#f3f2ec" }}>QR Space</div>
          </div>
          <div style={{ fontSize: 38, color: "#b9b7ae", maxWidth: 560, lineHeight: 1.25 }}>Beautiful QR codes with a memory behind them</div>
          <div style={{ fontSize: 28, color: "#c6ff2e", fontWeight: 700 }}>Photos · Video · Who sees it · Collectibles</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: N * S + 40, padding: 20, border: "2px solid #2a2a2e", borderRadius: 14 }}>
          {Array.from({ length: N * N }, (_, i) => (
            <div key={i} style={{ width: S, height: S, borderRadius: 4, background: cell(i % N, Math.floor(i / N)) ? (i % 5 ? "#f3f2ec" : "#c6ff2e") : "transparent" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
