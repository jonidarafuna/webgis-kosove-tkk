/**
 * Verifikon që skedarët statikë për GitHub Pages ekzistojnë dhe nuk janë bosh.
 * Përdorim: node web/scripts/verify-static-data.mjs
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..");

const REQUIRED = [
  { path: "data/monuments/arkeologjike.geojson", minFeatures: 1 },
  { path: "data/monuments/arkitekturore.geojson", minFeatures: 1 },
  { path: "data/monuments/luajtshme.geojson", minFeatures: 1 },
  { path: "data/boundaries/kosova.geojson", minFeatures: 1 },
  { path: "data/boundaries/rajonet.geojson", minFeatures: 1 },
  { path: "data/boundaries/komunat.geojson", minFeatures: 1 },
  { path: "data/photos.json", minKeys: 1 },
  { path: "data/display-en.json", minKeys: 1 },
];

let failed = false;

for (const item of REQUIRED) {
  const full = join(WEB, item.path);
  try {
    const raw = await readFile(full, "utf8");
    const data = JSON.parse(raw);
    if (item.minFeatures != null) {
      const n = (data.features || []).length;
      if (n < item.minFeatures) {
        console.error(`✗ ${item.path}: vetëm ${n} objekte`);
        failed = true;
        continue;
      }
      console.log(`✓ ${item.path} — ${n} objekte`);
    } else if (item.minKeys != null) {
      const keys = Object.keys(data).filter((k) => !k.startsWith("_"));
      if (keys.length < item.minKeys) {
        console.error(`✗ ${item.path}: shumë pak hyrje (${keys.length})`);
        failed = true;
        continue;
      }
      console.log(`✓ ${item.path} — ${keys.length} hyrje`);
    }
  } catch (e) {
    console.error(`✗ ${item.path}: ${e.message || e}`);
    failed = true;
  }
}

if (failed) {
  console.error(
    "\nMungon të dhëna statike. Nis GeoServer + HAPNI.bat, pastaj EKSPORTO-MONUMENTE.bat dhe EKSPORTO-KUFIJT.bat."
  );
  process.exit(1);
}

console.log("\nTë dhënat statike janë gati për GitHub Pages.");
