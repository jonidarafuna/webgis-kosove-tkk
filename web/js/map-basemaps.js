/**
 * Basemap — auto (sipas shkallës) / OSM / Google Satellite + tema errët/e çelët
 */

const BASEMAP_MODE_KEY = "tkkBasemapMode";

let basemapMode = "auto";
let syncBasemapImpl = null;
let basemapMap = null;
let basemapOsmLayerLight = null;
let basemapOsmLayerDark = null;
/** Shtresa aktive CARTO/OSM (për referenca të vjetra) */
let basemapOsmLayer = null;
let basemapSatelliteLayer = null;
let basemapSatelliteFallbackLayer = null;
let activeSatelliteLayer = null;
let googleSatelliteFailed = false;
let googleTileErrorStreak = 0;
let satelliteShownInAuto = false;
let lastBasemapTileKey = "";

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
  if (!map) return false;

  const m = getScaleBarMeters(map);
  const onBelow =
    typeof SATELLITE_AUTO_ON_MAX_METERS === "number"
      ? SATELLITE_AUTO_ON_MAX_METERS
      : SATELLITE_MAX_SCALE_METERS * 0.9;
  const maxM =
    typeof SATELLITE_MAX_SCALE_METERS === "number"
      ? SATELLITE_MAX_SCALE_METERS
      : 10000;
  const minZoom =
    typeof SATELLITE_AUTO_MIN_ZOOM === "number"
      ? SATELLITE_AUTO_MIN_ZOOM
      : 10;
  const zoom = typeof map.getZoom === "function" ? map.getZoom() : 0;

  if (satelliteShownInAuto) {
    if (m != null && m >= maxM) return false;
    return true;
  }

  if (m != null && m < onBelow) return true;
  if (zoom >= minZoom) return true;
  return false;
}

function setSatelliteLayerOpacity(layer) {
  if (!layer) return;
  layer.setOpacity(SATELLITE_LAYER_OPACITY);
}

function loadBasemapMode() {
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

function getSatelliteTileUrl() {
  const withLabels = basemapMode === "satellite";
  if (typeof window.tkkGoogleSatelliteTileUrl === "function") {
    return window.tkkGoogleSatelliteTileUrl(withLabels);
  }
  return withLabels ? GOOGLE_SATELLITE_LABELS_URL : GOOGLE_SATELLITE_URL;
}

function getSatelliteBlendOpacity() {
  return isLightTheme() ? 0.22 : SATELLITE_DARK_BLEND_OPACITY;
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

function updatePairedOsmLayerUrls() {
  if (!basemapOsmLayerLight || !basemapOsmLayerDark) return;
  basemapOsmLayerLight.setUrl(getOsmTileUrlForTheme("light"));
  basemapOsmLayerDark.setUrl(getOsmTileUrlForTheme("dark"));
  if (typeof basemapOsmLayerLight.redraw === "function") {
    basemapOsmLayerLight.redraw();
  }
  if (typeof basemapOsmLayerDark.redraw === "function") {
    basemapOsmLayerDark.redraw();
  }
}

function getActiveOsmLayer() {
  return isLightTheme() ? basemapOsmLayerLight : basemapOsmLayerDark;
}

function getInactiveOsmLayer() {
  return isLightTheme() ? basemapOsmLayerDark : basemapOsmLayerLight;
}

/** Vendos shtresën e duhur (e çelët / e errët) — pa setUrl në cache */
function mountActiveOsmLayer(opacity) {
  if (!basemapMap || !basemapOsmLayerLight || !basemapOsmLayerDark) return;

  const active = getActiveOsmLayer();
  const inactive = getInactiveOsmLayer();
  basemapOsmLayer = active;
  window.tkkBasemapOsm = active;
  window.tkkBasemapDark = basemapOsmLayerDark;

  if (inactive && basemapMap.hasLayer(inactive)) {
    basemapMap.removeLayer(inactive);
  }
  if (!basemapMap.hasLayer(active)) {
    active.addTo(basemapMap);
  }
  active.setOpacity(opacity != null ? opacity : 1);
  if (typeof active.bringToBack === "function") {
    active.bringToBack();
  }
}

function applyBasemapTileUrls() {
  updatePairedOsmLayerUrls();
  if (basemapSatelliteLayer) {
    basemapSatelliteLayer.setUrl(getSatelliteTileUrl());
    if (typeof basemapSatelliteLayer.redraw === "function") {
      basemapSatelliteLayer.redraw();
    }
  }
}

function shouldUseSatelliteBasemap(map) {
  const m = map || basemapMap;
  if (!m) return false;
  if (basemapMode === "satellite") return true;
  if (basemapMode === "auto") return shouldShowSatelliteAuto(m);
  return false;
}

function applyThemeToBasemap() {
  if (!basemapMap || !basemapOsmLayerLight) return;

  updatePairedOsmLayerUrls();
  lastBasemapTileKey = "";

  if (shouldUseSatelliteBasemap()) {
    ensureSatelliteVisible();
  } else {
    ensureOsmVisible();
  }
}

function clearSatellite() {
  if (!basemapMap) return;
  if (activeSatelliteLayer && basemapMap.hasLayer(activeSatelliteLayer)) {
    basemapMap.removeLayer(activeSatelliteLayer);
  }
  activeSatelliteLayer = null;
}

function pickSatelliteLayer() {
  if (googleSatelliteFailed && basemapSatelliteFallbackLayer) {
    return basemapSatelliteFallbackLayer;
  }
  return basemapSatelliteLayer;
}

function useSatelliteLayer(layer) {
  if (!basemapMap || !layer) return;

  const alreadyOn =
    activeSatelliteLayer === layer && basemapMap.hasLayer(layer);
  if (!alreadyOn) {
    if (activeSatelliteLayer && basemapMap.hasLayer(activeSatelliteLayer)) {
      basemapMap.removeLayer(activeSatelliteLayer);
    }
    activeSatelliteLayer = layer;
    setSatelliteLayerOpacity(layer);
    layer.addTo(basemapMap);
  }

  mountActiveOsmLayer(getSatelliteBlendOpacity());

  if (typeof layer.bringToFront === "function") {
    layer.bringToFront();
  }
}

function ensureSatelliteVisible() {
  if (!basemapMap) return;
  useSatelliteLayer(pickSatelliteLayer());
  satelliteShownInAuto = true;
}

function ensureOsmVisible() {
  if (!basemapMap) return;
  clearSatellite();
  satelliteShownInAuto = false;
  mountActiveOsmLayer(1);
}

function syncBasemap() {
  if (!basemapMap) return;

  const theme = isLightTheme() ? "light" : "dark";
  const tileKey = basemapMode + "|" + theme;
  if (tileKey !== lastBasemapTileKey) {
    lastBasemapTileKey = tileKey;
    applyBasemapTileUrls();
  }

  if (shouldUseSatelliteBasemap(basemapMap)) {
    ensureSatelliteVisible();
  } else {
    ensureOsmVisible();
  }

  if (
    basemapOsmLayer &&
    basemapMap.hasLayer(basemapOsmLayer) &&
    activeSatelliteLayer &&
    basemapMap.hasLayer(activeSatelliteLayer)
  ) {
    basemapOsmLayer.setOpacity(getSatelliteBlendOpacity());
  }

  if (typeof window.syncScaleDependentAdminLayers === "function") {
    window.syncScaleDependentAdminLayers();
  }
}

function setBasemapMode(mode) {
  if (mode !== "auto" && mode !== "osm" && mode !== "satellite") return;
  basemapMode = mode;
  localStorage.setItem(BASEMAP_MODE_KEY, mode);
  if (mode === "satellite" || mode === "auto") {
    googleSatelliteFailed = false;
    googleTileErrorStreak = 0;
  }
  lastBasemapTileKey = "";
  if (syncBasemapImpl) {
    syncBasemapImpl();
  }
  notifyBasemapModeChange();
}

function initMapBasemaps(map) {
  basemapMap = map;

  createPairedOsmLayers();
  mountActiveOsmLayer(1);

  basemapSatelliteLayer = L.tileLayer(getSatelliteTileUrl(), {
    attribution: GOOGLE_SATELLITE_ATTRIBUTION,
    subdomains: GOOGLE_SATELLITE_SUBDOMAINS,
    maxZoom: 20,
    detectRetina: false,
    opacity: SATELLITE_LAYER_OPACITY,
  });

  basemapSatelliteFallbackLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
      opacity: SATELLITE_LAYER_OPACITY,
    }
  );

  basemapSatelliteLayer.on("tileload", () => {
    googleTileErrorStreak = 0;
  });

  basemapSatelliteLayer.on("tileerror", () => {
    if (googleSatelliteFailed || basemapMode === "osm") return;
    googleTileErrorStreak += 1;
    if (googleTileErrorStreak < 6) return;
    googleSatelliteFailed = true;
    console.warn("Google Satellite: pllaka dështuan, përdor Esri Imagery.");
    if (basemapMode === "satellite" || shouldShowSatelliteAuto(map)) {
      useSatelliteLayer(basemapSatelliteFallbackLayer);
    }
  });

  syncBasemapImpl = syncBasemap;
  lastBasemapTileKey = "";
  syncBasemap();
  map.whenReady(syncBasemap);

  map.on("zoom", syncBasemap);
  map.on("zoomend", syncBasemap);
  map.on("moveend", syncBasemap);

  window.getScaleBarMeters = getScaleBarMeters;
  window.shouldShowSatellite = (m) => shouldShowSatelliteAuto(m || map);
  window.tkkBasemapOsm = basemapOsmLayer;
  window.tkkBasemapDark = basemapOsmLayerDark;
  window.tkkBasemapSatellite = basemapSatelliteLayer;
  window.syncBasemapForZoom = syncBasemap;
  window.getBasemapMode = getBasemapMode;
  window.setBasemapMode = setBasemapMode;
}

window.getBasemapMode = getBasemapMode;
window.setBasemapMode = setBasemapMode;
window.applyThemeToBasemap = applyThemeToBasemap;

window.addEventListener("tkk:theme-change", () => {
  applyThemeToBasemap();
});
