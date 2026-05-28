/**
 * Basemap — auto (sipas shkallës) / OSM / Google Satellite + tema errët/e çelët
 */

const BASEMAP_MODE_KEY = "tkkBasemapMode";

let basemapMode = "auto";
let syncBasemapImpl = null;
let basemapMap = null;
let basemapOsmLayer = null;
let basemapSatelliteLayer = null;
let basemapSatelliteFallbackLayer = null;
let activeSatelliteLayer = null;
let googleSatelliteFailed = false;
let satelliteShownInAuto = false;
let lastBasemapTileKey = "";

loadBasemapMode();

function getScaleBarMeters(map) {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  const metersPerPixel =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
  return metersPerPixel * SATELLITE_SCALE_BAR_PX;
}

/** Auto: jo te “10 km”; po pas zoom-in (5 km, 2 km, …) */
function shouldShowSatelliteAuto(map) {
  const m = getScaleBarMeters(map);
  const onBelow =
    typeof SATELLITE_AUTO_ON_MAX_METERS === "number"
      ? SATELLITE_AUTO_ON_MAX_METERS
      : SATELLITE_MAX_SCALE_METERS * 0.9;
  if (satelliteShownInAuto) {
    return m < SATELLITE_MAX_SCALE_METERS;
  }
  return m < onBelow;
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

function getOsmTileUrl() {
  const light = typeof getTheme === "function" && getTheme() === "light";
  const withLabels = basemapMode === "osm";
  if (withLabels) {
    return light ? BASEMAP_URL_LIGHT_LABELS : BASEMAP_URL_DARK_LABELS;
  }
  return light ? BASEMAP_URL_LIGHT : BASEMAP_URL_DARK;
}

function getSatelliteTileUrl() {
  return basemapMode === "satellite"
    ? GOOGLE_SATELLITE_LABELS_URL
    : GOOGLE_SATELLITE_URL;
}

function getSatelliteBlendOpacity() {
  return typeof getTheme === "function" && getTheme() === "light"
    ? 0.22
    : SATELLITE_DARK_BLEND_OPACITY;
}

function createOsmBasemapLayer() {
  return L.tileLayer(getOsmTileUrl(), {
    attribution: BASEMAP_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 20,
    detectRetina: true,
  });
}

function applyBasemapTileUrls() {
  if (!basemapOsmLayer || !basemapSatelliteLayer) return;

  basemapOsmLayer.setUrl(getOsmTileUrl());
  if (typeof basemapOsmLayer.redraw === "function") {
    basemapOsmLayer.redraw();
  }

  basemapSatelliteLayer.setUrl(getSatelliteTileUrl());
  if (typeof basemapSatelliteLayer.redraw === "function") {
    basemapSatelliteLayer.redraw();
  }
}

/** Rindërton shtresën OSM/CARTO — Leaflet ndonjëherë nuk pastron cache me setUrl */
function rebuildOsmBasemapForTheme() {
  if (!basemapMap) return;

  const hadSatellite =
    activeSatelliteLayer && basemapMap.hasLayer(activeSatelliteLayer);
  const osmWasOnMap = basemapOsmLayer && basemapMap.hasLayer(basemapOsmLayer);

  if (basemapOsmLayer) {
    basemapMap.removeLayer(basemapOsmLayer);
  }

  basemapOsmLayer = createOsmBasemapLayer();
  window.tkkBasemapOsm = basemapOsmLayer;
  window.tkkBasemapDark = basemapOsmLayer;

  if (hadSatellite) {
    basemapOsmLayer.addTo(basemapMap);
    basemapOsmLayer.setOpacity(getSatelliteBlendOpacity());
    basemapOsmLayer.bringToBack();
    if (typeof activeSatelliteLayer.bringToFront === "function") {
      activeSatelliteLayer.bringToFront();
    }
  } else if (osmWasOnMap || basemapMode === "osm" || basemapMode === "auto") {
    basemapOsmLayer.addTo(basemapMap);
    basemapOsmLayer.setOpacity(1);
    basemapOsmLayer.bringToBack();
  }

  lastBasemapTileKey = "";
}

function applyThemeToBasemap() {
  if (!basemapMap) return;

  if (basemapOsmLayer) {
    rebuildOsmBasemapForTheme();
  }

  if (basemapSatelliteLayer) {
    basemapSatelliteLayer.setUrl(getSatelliteTileUrl());
    if (typeof basemapSatelliteLayer.redraw === "function") {
      basemapSatelliteLayer.redraw();
    }
  }

  if (syncBasemapImpl) {
    syncBasemapImpl();
  } else {
    syncBasemap();
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

  if (activeSatelliteLayer && basemapMap.hasLayer(activeSatelliteLayer)) {
    basemapMap.removeLayer(activeSatelliteLayer);
  }

  activeSatelliteLayer = layer;
  setSatelliteLayerOpacity(layer);
  layer.addTo(basemapMap);

  if (!basemapMap.hasLayer(basemapOsmLayer)) {
    basemapOsmLayer.addTo(basemapMap);
  }
  basemapOsmLayer.setOpacity(getSatelliteBlendOpacity());
  basemapOsmLayer.bringToBack();
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
  if (!basemapMap.hasLayer(basemapOsmLayer)) {
    basemapOsmLayer.addTo(basemapMap);
  }
  basemapOsmLayer.setOpacity(1);
  basemapOsmLayer.bringToBack();
}

function syncBasemap() {
  if (!basemapMap) return;

  const theme = typeof getTheme === "function" ? getTheme() : "dark";
  const tileKey = basemapMode + "|" + theme;
  if (tileKey !== lastBasemapTileKey) {
    lastBasemapTileKey = tileKey;
    applyBasemapTileUrls();
  }

  if (basemapMode === "osm") {
    ensureOsmVisible();
  } else if (basemapMode === "satellite") {
    ensureSatelliteVisible();
  } else if (shouldShowSatelliteAuto(basemapMap)) {
    ensureSatelliteVisible();
  } else {
    ensureOsmVisible();
  }

  if (
    basemapOsmLayer &&
    basemapMap &&
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
  }
  lastBasemapTileKey = "";
  if (syncBasemapImpl) {
    syncBasemapImpl();
  }
  notifyBasemapModeChange();
}

function initMapBasemaps(map) {
  basemapMap = map;

  basemapOsmLayer = createOsmBasemapLayer();

  basemapSatelliteLayer = L.tileLayer(GOOGLE_SATELLITE_URL, {
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

  basemapSatelliteLayer.on("tileerror", () => {
    if (googleSatelliteFailed) return;
    if (basemapMode === "osm") return;
    googleSatelliteFailed = true;
    console.warn("Google Satellite: pllaka dështuan, përdor Esri Imagery.");
    if (basemapMode === "satellite" || shouldShowSatelliteAuto(map)) {
      useSatelliteLayer(basemapSatelliteFallbackLayer);
    }
  });

  basemapOsmLayer.addTo(map);

  syncBasemapImpl = syncBasemap;
  lastBasemapTileKey = "";
  syncBasemap();

  map.on("zoomend", syncBasemap);
  map.on("moveend", syncBasemap);

  window.getScaleBarMeters = getScaleBarMeters;
  window.shouldShowSatellite = (m) => shouldShowSatelliteAuto(m || map);
  window.tkkBasemapOsm = basemapOsmLayer;
  window.tkkBasemapDark = basemapOsmLayer;
  window.tkkBasemapSatellite = basemapSatelliteLayer;
  window.syncBasemapForZoom = syncBasemap;
  window.getBasemapMode = getBasemapMode;
  window.setBasemapMode = setBasemapMode;
}

window.getBasemapMode = getBasemapMode;
window.setBasemapMode = setBasemapMode;
window.applyThemeToBasemap = applyThemeToBasemap;
