/**
 * Eksporton monumentet nga GeoServer (WFS) në GeoJSON për GitHub Pages.
 * Kërkon: GeoServer ON + node serve.js (HAPNI.bat) në http://localhost:5500
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const OUT_DIR = join(WEB_ROOT, "data", "monuments");
const BASE = process.env.TKK_EXPORT_BASE || "http://localhost:5500/geoserver/tkk/wfs";

const LAYERS = {
  arkeologjike: "tkk:sites_arkeologjike",
  arkitekturore: "tkk:sites_arkitekturore",
  luajtshme: "tkk:sites_luajtshme",
};

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

async function exportLayer(key, typeName) {
  const url = wfsUrl(typeName);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${key}: HTTP ${res.status}`);
  }
  if (text.trim().startsWith("<")) {
    throw new Error(
      `${key}: përgjigje XML — a është HAPNI.bat ON dhe GeoServer publikuar?`
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${key}: JSON i pavlefshëm`);
  }
  const n = (data.features || []).length;
  const outPath = join(OUT_DIR, `${key}.geojson`);
  await writeFile(outPath, JSON.stringify(data), "utf8");
  console.log(`  ✓ ${key}.geojson — ${n} objekte`);
  return n;
}

async function main() {
  console.log("Eksport monumentesh → data/monuments/");
  console.log("Burimi:", BASE);
  await mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  for (const [key, typeName] of Object.entries(LAYERS)) {
    total += await exportLayer(key, typeName);
  }

  const meta = {
    updated: new Date().toISOString(),
    monuments: total,
    layers: Object.keys(LAYERS),
  };
  await writeFile(
    join(WEB_ROOT, "data", "export-meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  );

  console.log(`\nGati. Gjithsej ${total} monumente.`);
  console.log("Tani: git add web/data && git commit && git push");
  console.log("Pastaj aktivizo GitHub Pages (shiko GITHUB-PAGES-HAP-PAS-HAPI.md).");
}

main().catch((err) => {
  console.error("\nGabim:", err.message || err);
  console.error(
    "\nKontrollo: GeoServer ON, dy-klik HAPNI.bat, hap http://localhost:5500"
  );
  process.exit(1);
});
