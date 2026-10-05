// Проверщик кодов (ZXing) работает на WebAssembly — кладём его файл в public, чтобы не грузить с чужого CDN.
import { copyFileSync } from "node:fs";
copyFileSync("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", "public/zxing_reader.wasm");
