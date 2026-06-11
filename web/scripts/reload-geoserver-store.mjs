/**
 * Rifreskon store-in detyra_gpkg në GeoServer pas ndryshimeve në DetyraGPKG.gpkg.
 * Kërkon: GeoServer ON (localhost:8080), kredencialet admin/geoserver (ose env).
 */
const GEOSERVER =
  (process.env.GEOSERVER_URL || "http://localhost:8080/geoserver").replace(
    /\/$/,
    ""
  );
const WORKSPACE = process.env.TKK_GEOSERVER_WS || "tkk";
const STORE = process.env.TKK_GEOSERVER_STORE || "detyra_gpkg";
const USER = process.env.GEOSERVER_USER || "admin";
const PASS = process.env.GEOSERVER_PASS || "geoserver";

const FEATURE_TYPES = [
  "sites_arkeologjike",
  "sites_arkitekturore",
  "sites_luajtshme",
  "Komunat",
  "Rajonet",
  "Kosova",
];

const auth =
  "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

async function gsPost(path) {
  const url = `${GEOSERVER}/rest${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.status;
}

async function main() {
  console.log(`GeoServer: ${GEOSERVER}`);
  console.log(`Store: ${WORKSPACE}/${STORE}`);
  console.log("");

  const resetCode = await gsPost("/reset");
  console.log(`✓ reset cache (${resetCode})`);

  for (const ft of FEATURE_TYPES) {
    const code = await gsPost(
      `/workspaces/${WORKSPACE}/datastores/${STORE}/featuretypes/${ft}/reset`
    );
    console.log(`✓ reset ${ft} (${code})`);
  }

  const reloadCode = await gsPost("/reload");
  console.log(`✓ reload catalog (${reloadCode})`);
  console.log("");
  console.log("Store u rifreskua. Rifresko faqen WebGIS (Ctrl+F5).");
}

main().catch((err) => {
  console.error("\nGABIM:", err.message);
  console.error(
    "Kontrollo: GeoServer ON, kredencialet, store detyra_gpkg në workspace tkk."
  );
  process.exit(1);
});
