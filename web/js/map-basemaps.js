/**
 * Basemap: Auto (imazh satelitor kur zoom in) / OSM / Satellite
 */
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

function isLightTheme() {
  return document.documentElement.getAttribute("data-theme") === "light";
}

function getScaleBarMeters(map) {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  const metersPerPixel =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
  return metersPerPixel * SATELLITE_SCALE_BAR_PX;
}

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

function getBasemapMode() {
  return basemapMode;
}

function notifyBasemapModeChange() {
  window.dispatchEvent(
    new CustomEvent("tkk:basemap-mode", { detail: { mode: basemapMode } })
  );
}

function getOsmTileUrlForTheme(themeKey) {
  const withLabels = basemapMode === "osm";
  if (themeKey === "light") {
    return withLabels ? BASEMAP_URL_LIGHT_LABELS : BASEMAP_URL_LIGHT;
  }
  return withLabels ? BASEMAP_URL_DARK_LABELS : BASEMAP_URL_DARK;
}

function getGoogleTileUrl() {
  const withLabels = basemapMode === "satellite";
  if (typeof window.tkkGoogleSatelliteTileUrl === "function") {
    return window.tkkGoogleSatelliteTileUrl(withLabels);
  }
  return withLabels ? GOOGLE_SATELLITE_LABELS_URL : GOOGLE_SATELLITE_URL;
}

function createPairedOsmLayers() {
  const opts = {
    attribution: BASEMAP_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 20,
    detectRetina: true,
  };
  basemapOsmLayerLight = L.tileLayer(getOsmTileUrlForTheme("light"), opts);
  basemapOsmLayerDark = L.tileLayer(getOsmTileUrlForTheme("dark"), opts);
}

function getActiveOsmLayer() {
  return isLightTheme() ? basemapOsmLayerLight : basemapOsmLayerDark;
}

function hideAllOsmLayers() {
  if (!basemapMap) return;
  [basemapOsmLayerLight, basemapOsmLayerDark].forEach((layer) => {
    if (layer && basemapMap.hasLayer(layer)) {
      basemapMap.removeLayer(layer);
    }
  });
}

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

function shouldUseSatellite(map) {
  const m = map || basemapMap;
  if (!m) return false;
  if (basemapMode === "satellite") return true;
  if (basemapMode === "auto") return shouldShowSatelliteAuto(m);
  return false;
}

function clearSatellite() {
  if (!basemapMap) return;
  [basemapGoogleLayer, basemapEsriLayer, activeSatelliteLayer].forEach((layer) => {
    if (layer && basemapMap.hasLayer(layer)) {
      basemapMap.removeLayer(layer);
    }
  });
  activeSatelliteLayer = null;
}

function getImageryLayer() {
  if (useGoogleImagery && basemapGoogleLayer) {
    return basemapGoogleLayer;
  }
  return basemapEsriLayer;
}

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

function showOsmBasemap() {
  if (!basemapMap) return;
  clearSatellite();
  satelliteWasOn = false;
  window.tkkSatelliteActive = false;
  showOsmLayer();
}

function syncBasemap() {
  if (!basemapMap || !basemapReady) return;

  if (shouldUseSatellite(basemapMap)) {
    showSatelliteLayer();
  } else {
    showOsmBasemap();
  }

  if (typeof window.syncScaleDependentAdminLayers === "function") {
    window.syncScaleDependentAdminLayers();
  }
}

function setBasemapMode(mode) {
  if (mode !== "auto" && mode !== "osm" && mode !== "satellite") return;
  basemapMode = mode;
  localStorage.setItem(BASEMAP_MODE_KEY, mode);
  localStorage.setItem("tkkBasemapModeVer", String(BASEMAP_MODE_VERSION));
  satelliteWasOn = false;
  syncBasemap();
  notifyBasemapModeChange();
}

function createGoogleLayer() {
  const url = getGoogleTileUrl();
  const isProxy = String(url).indexOf("/google-tiles/") !== -1;
  return L.tileLayer(url, {
    attribution: GOOGLE_SATELLITE_ATTRIBUTION,
    subdomains: isProxy ? "" : GOOGLE_SATELLITE_SUBDOMAINS,
    maxZoom: 20,
    opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,
  });
}

function createEsriLayer() {
  return L.tileLayer(ESRI_IMAGERY_URL, {
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
    opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,
  });
}

function probeGoogleTilesAvailable() {
  if (window.tkkIsStaticPublish) return Promise.resolve(false);
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
    .catch(() => false);
}

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

function finishBasemapInit(map) {
  basemapReady = true;
  bindBasemapGlobals(map);

  if (window.tkkIsStaticPublish) {
    useGoogleImagery = false;
    window.tkkBasemapSatellite = basemapEsriLayer;
    syncBasemap();
    return;
  }

  useGoogleImagery = false;
  window.tkkBasemapSatellite = basemapEsriLayer;
  syncBasemap();

  probeGoogleTilesAvailable().then((ok) => {
    useGoogleImagery = ok;
    window.tkkBasemapSatellite = getImageryLayer();
    syncBasemap();
  });
}

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
