/**
 * Eksporton komunat nga WFS — përdoren për kufirin, rajonet dhe komunat në GitHub Pages.
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "boundaries");
const BASE = process.env.TKK_EXPORT_BASE || "http://localhost:5500/geoserver/tkk/wfs";

const KOMUNAT_TYPE_NAMES = ["tkk:Komunat", "tkk:komunat", "Komunat"];

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

async function fetchKomunat() {
  let lastErr;
  for (const typeName of KOMUNAT_TYPE_NAMES) {
    try {
      const res = await fetch(wfsUrl(typeName));
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (text.trim().startsWith("<")) throw new Error("XML, jo JSON");
      const data = JSON.parse(text);
      const n = (data.features || []).length;
      if (!n) throw new Error("pa geometri");
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("komunat dështoi");
}

async function main() {
  console.log("Eksport kufijve → data/boundaries/");
  await mkdir(OUT_DIR, { recursive: true });

  const komunat = await fetchKomunat();
  const path = join(OUT_DIR, "komunat.geojson");
  await writeFile(path, JSON.stringify(komunat), "utf8");
  console.log(`  ✓ komunat.geojson — ${komunat.features.length} objekte`);

  await copyFile(path, join(OUT_DIR, "kosova.geojson"));
  await copyFile(path, join(OUT_DIR, "rajonet.geojson"));
  console.log("  ✓ kosova.geojson + rajonet.geojson (kopje komunash)");

  console.log("\nGati. Push + rifresko GitHub Pages (Ctrl+F5).");
}

main().catch((err) => {
  console.error("\nGabim:", err.message || err);
  console.error("Kontrollo GeoServer + HAPNI.bat");
  process.exit(1);
});
