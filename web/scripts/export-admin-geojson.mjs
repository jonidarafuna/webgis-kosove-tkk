/**
 * Eksporton kufijtë për GitHub Pages (pa varësi të jashtme):
 * - komunat: 38 komunat
 * - kosova: kufiri i jashtëm i vendit (skajet e jashtme të komunave)
 * - rajonet: 7 rajone (e njëjta logjikë, grupuar sipas Rajoni)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "boundaries");
const BASE = process.env.TKK_EXPORT_BASE || "http://localhost:5500/geoserver/tkk/wfs";

const KOMUNAT_TYPE_NAMES = ["tkk:Komunat", "tkk:komunat", "Komunat"];
const COORD_PREC = 5;

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

function roundCoord(n) {
  return Math.round(n * 10 ** COORD_PREC) / 10 ** COORD_PREC;
}

function samePoint(a, b) {
  return (
    roundCoord(a[0]) === roundCoord(b[0]) &&
    roundCoord(a[1]) === roundCoord(b[1])
  );
}

function edgeKey(a, b) {
  const p1 = `${roundCoord(a[0])},${roundCoord(a[1])}`;
  const p2 = `${roundCoord(b[0])},${roundCoord(b[1])}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

function collectOuterRingEdges(geometry) {
  const edges = [];
  const addRing = (ring) => {
    if (!ring || ring.length < 2) return;
    for (let i = 0; i < ring.length - 1; i++) {
      edges.push([ring[i], ring[i + 1]]);
    }
  };

  if (geometry.type === "Polygon") {
    addRing(geometry.coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((poly) => addRing(poly[0]));
  }
  return edges;
}

function dissolveOuterBoundary(features) {
  const counts = new Map();
  const edgeByKey = new Map();

  features.forEach((feature) => {
    if (!feature?.geometry) return;
    collectOuterRingEdges(feature.geometry).forEach(([a, b]) => {
      const key = edgeKey(a, b);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!edgeByKey.has(key)) edgeByKey.set(key, [a, b]);
    });
  });

  const boundaryEdges = [];
  for (const [key, n] of counts) {
    if (n === 1) boundaryEdges.push(edgeByKey.get(key));
  }

  const rings = chainEdges(boundaryEdges);
  if (!rings.length) return null;

  const geometry =
    rings.length === 1
      ? { type: "Polygon", coordinates: [rings[0]] }
      : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };

  return { type: "Feature", properties: {}, geometry };
}

function chainEdges(edges) {
  if (!edges.length) return [];

  const pool = edges.map((e) => [e[0], e[1]]);
  const used = new Array(pool.length).fill(false);
  const rings = [];

  for (let start = 0; start < pool.length; start++) {
    if (used[start]) continue;

    const ring = [pool[start][0].slice(), pool[start][1].slice()];
    used[start] = true;
    let tip = ring[1];

    for (let guard = 0; guard < pool.length + 2; guard++) {
      let found = -1;
      let reverse = false;

      for (let i = 0; i < pool.length; i++) {
        if (used[i]) continue;
        if (samePoint(pool[i][0], tip)) {
          found = i;
          reverse = false;
          break;
        }
        if (samePoint(pool[i][1], tip)) {
          found = i;
          reverse = true;
          break;
        }
      }

      if (found < 0) break;

      used[found] = true;
      tip = reverse ? pool[found][0] : pool[found][1];
      ring.push(tip.slice());

      if (samePoint(tip, ring[0])) break;
    }

    if (ring.length >= 4) {
      if (!samePoint(ring[0], ring[ring.length - 1])) {
        ring.push(ring[0].slice());
      }
      rings.push(ring);
    }
  }

  return rings;
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
      console.log(`  ✓ komunat.geojson — ${n} komunat`);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("komunat dështoi");
}

function buildRajonet(komunatFeatures) {
  const groups = new Map();
  komunatFeatures.forEach((f) => {
    const name =
      f.properties?.Rajoni ||
      f.properties?.rajoni ||
      f.properties?.shapeName ||
      "Rajon";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(f);
  });

  const features = [];
  for (const [rajoni, list] of groups) {
    const merged = dissolveOuterBoundary(list);
    if (!merged) continue;
    merged.properties = { Rajoni: rajoni, emri: rajoni };
    features.push(merged);
  }
  return { type: "FeatureCollection", features };
}

async function main() {
  console.log("Eksport kufijve → data/boundaries/");
  await mkdir(OUT_DIR, { recursive: true });

  const komunat = await fetchKomunat();
  const feats = komunat.features || [];

  await writeFile(
    join(OUT_DIR, "komunat.geojson"),
    JSON.stringify(komunat),
    "utf8"
  );

  const kosovaFeature = dissolveOuterBoundary(feats);
  if (!kosovaFeature) throw new Error("kosova: kufiri i jashtëm dështoi");
  kosovaFeature.properties = { emri: "Kosova" };
  await writeFile(
    join(OUT_DIR, "kosova.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: [kosovaFeature] }),
    "utf8"
  );
  console.log("  ✓ kosova.geojson — 1 kufër i vendit");

  const rajonet = buildRajonet(feats);
  await writeFile(
    join(OUT_DIR, "rajonet.geojson"),
    JSON.stringify(rajonet),
    "utf8"
  );
  console.log(`  ✓ rajonet.geojson — ${rajonet.features.length} rajone`);

  console.log("\nGati. Commit + push + Ctrl+F5");
}

main().catch((err) => {
  console.error("\nGabim:", err.message || err);
  console.error("Kontrollo GeoServer + HAPNI.bat");
  process.exit(1);
});
