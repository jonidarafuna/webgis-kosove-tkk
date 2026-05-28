/**
 * Eksporton kufijtë admin (WFS) për GitHub Pages.
 * Kërkon GeoServer + HAPNI.bat në http://localhost:5500
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "boundaries");
const BASE = process.env.TKK_EXPORT_BASE || "http://localhost:5500/geoserver/tkk/wfs";

const LAYERS = [
  { file: "kosova", typeName: "tkk:Kosova" },
  { file: "rajonet", typeName: "tkk:Rajonet", alt: ["tkk:rajonet", "Rajonet"] },
  { file: "komunat", typeName: "tkk:Komunat", alt: ["tkk:komunat", "Komunat"] },
];

function wfsUrl(typeName) {
  const q = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
  });
  return `${BASE}?${q}`;
}

async function tryExport(file, names) {
  let lastErr;
  for (const typeName of names) {
    try {
      const res = await fetch(wfsUrl(typeName));
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (text.trim().startsWith("<")) throw new Error("XML, jo JSON");
      const data = JSON.parse(text);
      const n = (data.features || []).length;
      if (!n) throw new Error("pa geometri");
      const outPath = join(OUT_DIR, `${file}.geojson`);
      await writeFile(outPath, JSON.stringify(data), "utf8");
      console.log(`  ✓ ${file}.geojson — ${n} objekte (${typeName})`);
      return n;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("dështoi");
}

async function main() {
  console.log("Eksport kufijve → data/boundaries/");
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  for (const layer of LAYERS) {
    const names = [layer.typeName, ...(layer.alt || [])];
    total += await tryExport(layer.file, names);
  }
  console.log(`\nGati. ${total} objekte. Push + rifresko GitHub Pages.`);
}

main().catch((err) => {
  console.error("\nGabim:", err.message || err);
  console.error("Kontrollo GeoServer + HAPNI.bat");
  process.exit(1);
});
