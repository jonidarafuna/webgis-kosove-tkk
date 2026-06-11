/**
 * map-basemaps.js — Sfondi i hartës (basemap)
 *
 * Menaxhon tre mënyra: Auto (OSM + satelit kur zmadhohet), OSM me/ pa etiketa,
 * dhe Satelit (Google nëse proxy funksionon, përndryshe Esri).
 * Ruajtja e zgjedhjes bëhet në localStorage.
 */

// ===== SEKSIONI 1: Variablat dhe parazgjedhjet =====
const BASEMAP_MODE_KEY = "tkkBasemapMode";
const BASEMAP_MODE_VERSION = 5;
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

let basemapMode = "auto";
let basemapMap = null;
let basemapOsmLayerLight = null;
let basemapOsmLayerDark = null;
let basemapOsmLayer = null;
let basemapGoogleLayer = null;
let basemapEsriLayer = null;
let activeSatelliteLayer = null;
let useGoogleImagery = false;
let satelliteWasOn = false;
let basemapReady = false;

loadBasemapMode();

// ===== SEKSIONI 2: Shkalla dhe rregullat e Auto-satelitit =====

/** A është tema e çelët (Pamje → Light)? */
function isLightTheme() {
  return document.documentElement.getAttribute("data-theme") === "light";
}

/** Llogarit sa metra përfaqëson shiriti i shkallës në ekran (96 px) */
function getScaleBarMeters(map) {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  const metersPerPixel =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
  return metersPerPixel * SATELLITE_SCALE_BAR_PX;
}

/** Në modalitetin Auto: a duhet të shfaqet sateliti sipas zoom-it dhe shkallës? */
function shouldShowSatelliteAuto(map) {
  if (!map || typeof map.getZoom !== "function") return false;

  const z = map.getZoom();
  const onZ =
    typeof SATELLITE_AUTO_MIN_ZOOM === "number" ? SATELLITE_AUTO_MIN_ZOOM : 9;
  const offZ =
    typeof SATELLITE_AUTO_OFF_ZOOM === "number"
      ? SATELLITE_AUTO_OFF_ZOOM
      : onZ - 1;
  const maxM =
    typeof SATELLITE_MAX_SCALE_METERS === "number"
      ? SATELLITE_MAX_SCALE_METERS
      : 10000;
  const onM =
    typeof SATELLITE_AUTO_ON_MAX_METERS === "number"
      ? SATELLITE_AUTO_ON_MAX_METERS
      : maxM;

  let m = null;
  try {
    m = getScaleBarMeters(map);
  } catch {
    m = null;
  }

  if (satelliteWasOn) {
    if (z <= offZ) return false;
    if (m != null && m >= maxM) return false;
    return true;
  }

  if (z >= onZ) return true;
  if (m != null && m < onM) return true;
  return false;
}

// ===== SEKSIONI 3: Ruajtja dhe ngjarjet e modalitetit =====

/** Lexon modalitetin nga localStorage; reset nëse ndryshon versioni */
function loadBasemapMode() {
  const ver = Number(localStorage.getItem("tkkBasemapModeVer") || "0");
  if (ver < BASEMAP_MODE_VERSION) {
    localStorage.setItem(BASEMAP_MODE_KEY, "auto");
    localStorage.setItem("tkkBasemapModeVer", String(BASEMAP_MODE_VERSION));
    basemapMode = "auto";
    return;
  }
  const saved = localStorage.getItem(BASEMAP_MODE_KEY);
  if (saved === "auto" || saved === "osm" || saved === "satellite") {
    basemapMode = saved;
  }
}

/** Kthen modalitetin aktual: "auto" | "osm" | "satellite" */
function getBasemapMode() {
  return basemapMode;
}

/** Njofton pjesët e tjera të UI kur ndryshon basemap-i */
function notifyBasemapModeChange() {
  window.dispatchEvent(
    new CustomEvent("tkk:basemap-mode", { detail: { mode: basemapMode } })
  );
}

// ===== SEKSIONI 4: Shtresat OSM (e çelët / e errët) =====

/** URL e pllakave CARTO sipas temës dhe nëse duhen etiketa */
function getOsmTileUrlForTheme(themeKey) {
  const withLabels = basemapMode === "osm";
  if (themeKey === "light") {
    return withLabels ? BASEMAP_URL_LIGHT_LABELS : BASEMAP_URL_LIGHT;
  }
  return withLabels ? BASEMAP_URL_DARK_LABELS : BASEMAP_URL_DARK;
}

/** URL e pllakave Google (me ose pa emra) — proxy lokale nëse ekziston */
function getGoogleTileUrl() {
  const withLabels = basemapMode === "satellite";
  if (typeof window.tkkGoogleSatelliteTileUrl === "function") {
    return window.tkkGoogleSatelliteTileUrl(withLabels);
  }
  return withLabels ? GOOGLE_SATELLITE_LABELS_URL : GOOGLE_SATELLITE_URL;
}

/** Krijon dy shtresa OSM (light + dark) që ndërrohen me temën */
function createPairedOsmLayers() {
  const opts = {
    attribution: BASEMAP_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 20,
    detectRetina: true,
    crossOrigin: true,
  };
  basemapOsmLayerLight = L.tileLayer(getOsmTileUrlForTheme("light"), opts);
  basemapOsmLayerDark = L.tileLayer(getOsmTileUrlForTheme("dark"), opts);
}

/** Cila shtresë OSM duhet aktive sipas temës aktuale */
function getActiveOsmLayer() {
  return isLightTheme() ? basemapOsmLayerLight : basemapOsmLayerDark;
}

/** Heq të dyja shtresat OSM nga harta */
function hideAllOsmLayers() {
  if (!basemapMap) return;
  [basemapOsmLayerLight, basemapOsmLayerDark].forEach((layer) => {
    if (layer && basemapMap.hasLayer(layer)) {
      basemapMap.removeLayer(layer);
    }
  });
}

/** Shfaq vetëm shtresën OSM që përputhet me temën */
function showOsmLayer() {
  if (!basemapMap || !basemapOsmLayerLight || !basemapOsmLayerDark) return;
  const active = getActiveOsmLayer();
  const inactive = isLightTheme() ? basemapOsmLayerDark : basemapOsmLayerLight;
  basemapOsmLayer = active;
  window.tkkBasemapOsm = active;
  window.tkkBasemapDark = basemapOsmLayerDark;
  if (inactive && basemapMap.hasLayer(inactive)) {
    basemapMap.removeLayer(inactive);
  }
  if (!basemapMap.hasLayer(active)) {
    active.addTo(basemapMap);
  }
  active.setOpacity(1);
  if (active.bringToBack) active.bringToBack();
}

// ===== SEKSIONI 5: Sateliti (Google / Esri) =====

/** A duhet sateliti sipas modalitetit dhe zoom-it? */
function shouldUseSatellite(map) {
  const m = map || basemapMap;
  if (!m) return false;
  if (basemapMode === "satellite") return true;
  if (basemapMode === "auto") return shouldShowSatelliteAuto(m);
  return false;
}

/** Heq shtresat satelitore nga harta */
function clearSatellite() {
  if (!basemapMap) return;
  [basemapGoogleLayer, basemapEsriLayer, activeSatelliteLayer].forEach((layer) => {
    if (layer && basemapMap.hasLayer(layer)) {
      basemapMap.removeLayer(layer);
    }
  });
  activeSatelliteLayer = null;
}

/** Zgjedh Google nëse është i disponueshëm, përndryshe Esri */
function getImageryLayer() {
  if (useGoogleImagery && basemapGoogleLayer) {
    return basemapGoogleLayer;
  }
  return basemapEsriLayer;
}

/** Vendos satelitin si sfond dhe fsheh OSM */
function showSatelliteLayer() {
  if (!basemapMap) return;
  const layer = getImageryLayer();
  if (!layer) return;

  hideAllOsmLayers();
  clearSatellite();

  activeSatelliteLayer = layer;
  const op =
    typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1;
  layer.setOpacity(op);
  layer.addTo(basemapMap);
  if (layer.bringToBack) layer.bringToBack();

  satelliteWasOn = true;
  window.tkkSatelliteActive = true;
}

/** Kthen në sfond OSM (heq satelitin) */
function showOsmBasemap() {
  if (!basemapMap) return;
  clearSatellite();
  satelliteWasOn = false;
  window.tkkSatelliteActive = false;
  showOsmLayer();
}

/** Pika kryesore: vendos OSM ose satelit sipas modalitetit dhe zoom-it */
function syncBasemap() {
  if (!basemapMap || !basemapReady) return;

  if (shouldUseSatellite(basemapMap)) {
    showSatelliteLayer();
  } else {
    showOsmBasemap();
  }

  try {
    if (typeof window.syncScaleDependentAdminLayers === "function") {
      window.syncScaleDependentAdminLayers();
    }
  } catch (err) {
    console.warn("syncScaleDependentAdminLayers:", err);
  }
}

/** Ndryshon modalitetin nga UI (Pamje) dhe ruan në localStorage */
function setBasemapMode(mode) {
  if (mode !== "auto" && mode !== "osm" && mode !== "satellite") return;
  basemapMode = mode;
  localStorage.setItem(BASEMAP_MODE_KEY, mode);
  localStorage.setItem("tkkBasemapModeVer", String(BASEMAP_MODE_VERSION));
  satelliteWasOn = false;
  syncBasemap();
  notifyBasemapModeChange();
}

/** Krijon shtresën e pllakave Google (ose përmes proxy /google-tiles/) */
function createGoogleLayer() {
  const url = getGoogleTileUrl();
  const isProxy = String(url).indexOf("/google-tiles/") !== -1;
  return L.tileLayer(url, {
    attribution: GOOGLE_SATELLITE_ATTRIBUTION,
    subdomains: isProxy ? "" : GOOGLE_SATELLITE_SUBDOMAINS,
    maxZoom: 20,
    opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,
    crossOrigin: true,
  });
}

/** Krijon shtresën rezervë Esri World Imagery */
function createEsriLayer() {
  return L.tileLayer(ESRI_IMAGERY_URL, {
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
    opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,
    crossOrigin: true,
  });
}

/** Teston pllakën Google direkt (GitHub Pages / publikim statik) */
function probeDirectGoogleTilesAvailable() {
  const template =
    typeof window.tkkGoogleSatelliteTileUrl === "function"
      ? window.tkkGoogleSatelliteTileUrl(false)
      : "";
  if (!template || String(template).indexOf("/google-tiles/") !== -1) {
    return Promise.resolve(false);
  }
  const testUrl = String(template)
    .replace("{s}", "0")
    .replace("{x}", "143")
    .replace("{y}", "96")
    .replace("{z}", "8");

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = testUrl;
  });
}

/** Teston nëse proxy Google në serve.js kthen imazh (localhost) */
function probeGoogleTilesAvailable() {
  if (window.tkkIsStaticPublish) {
    return probeDirectGoogleTilesAvailable();
  }
  const origin = window.location.origin || "";
  if (!origin) return Promise.resolve(false);
  const base = (
    typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "/"
  ).replace(/\/?$/, "/");
  const testUrl = origin + base + "google-tiles/8/143/96?lyrs=s";
  return fetch(testUrl, { method: "GET", cache: "no-store" })
    .then((r) => {
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      return r.ok && ct.indexOf("image") !== -1;
    })
    .catch(() => probeDirectGoogleTilesAvailable());
}

// ===== SEKSIONI 6: Inicializimi dhe eksporti global =====

/** Vendos funksionet në window që i përdor map.js dhe UI */
function bindBasemapGlobals(map) {
  window.getScaleBarMeters = getScaleBarMeters;
  window.shouldShowSatellite = (m) => shouldShowSatelliteAuto(m || map);
  window.tkkBasemapOsm = basemapOsmLayer;
  window.tkkBasemapDark = basemapOsmLayerDark;
  window.tkkBasemapSatellite = getImageryLayer();
  window.syncBasemapForZoom = syncBasemap;
  window.getBasemapMode = getBasemapMode;
  window.setBasemapMode = setBasemapMode;
}

/** Pas krijimit të shtresave: provon Google, pastaj sinkronizon basemap-in */
function finishBasemapInit(map) {
  basemapReady = true;
  bindBasemapGlobals(map);

  useGoogleImagery = false;
  window.tkkBasemapSatellite = basemapEsriLayer;
  syncBasemap();

  probeGoogleTilesAvailable().then((ok) => {
    useGoogleImagery = ok;
    window.tkkBasemapSatellite = getImageryLayer();
    syncBasemap();
  });
}

/** Thirret nga map.js — lidh basemap-et me instancën Leaflet */
function initMapBasemaps(map) {
  if (!map || typeof L === "undefined") {
    console.error("initMapBasemaps: harta nuk eshte gati.");
    return false;
  }

  basemapMap = map;

  if (!basemapOsmLayerLight) {
    createPairedOsmLayers();
    showOsmLayer();
  }

  if (!basemapEsriLayer) {
    basemapEsriLayer = createEsriLayer();
  }

  if (!basemapGoogleLayer) {
    basemapGoogleLayer = createGoogleLayer();
    let googleErrors = 0;
    basemapGoogleLayer.on("tileload", () => {
      googleErrors = 0;
    });
    basemapGoogleLayer.on("tileerror", () => {
      if (basemapMode === "osm") return;
      googleErrors += 1;
      if (googleErrors < 2) return;
      useGoogleImagery = false;
      window.tkkBasemapSatellite = basemapEsriLayer;
      if (shouldUseSatellite(basemapMap)) {
        showSatelliteLayer();
      }
    });
  }

  if (!basemapReady) {
    finishBasemapInit(map);
  } else {
    bindBasemapGlobals(map);
    syncBasemap();
  }

  return true;
}

/** Kur ndryshon tema (dark/light), rifreskon OSM/satellite */
function applyThemeToBasemap() {
  if (!basemapMap) return;
  syncBasemap();
}

window.getBasemapMode = getBasemapMode;
window.setBasemapMode = setBasemapMode;
window.applyThemeToBasemap = applyThemeToBasemap;
window.initMapBasemaps = initMapBasemaps;
window.syncBasemapForZoom = function () {
  if (!basemapMap) return;
  if (!basemapReady) {
    initMapBasemaps(basemapMap);
    return;
  }
  syncBasemap();
};

window.addEventListener("tkk:theme-change", () => {
  applyThemeToBasemap();
});
