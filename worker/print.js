// SVG -> PNG for print files (the custom-text shirt), with the bundled Inter Display Black (SIL OFL, see fonts/OFL.txt).
// Kept out of shop.js so the Node tests never load the WebAssembly.
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import font from "./fonts/InterDisplay-Black-latin.otf";

let ready = null;
export async function svgToPng(svg, width) {
  ready ||= initWasm(wasm);
  await ready;
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { fontBuffers: [new Uint8Array(font)], loadSystemFonts: false, defaultFontFamily: "Inter Display" } });
  return r.render().asPng();
}
