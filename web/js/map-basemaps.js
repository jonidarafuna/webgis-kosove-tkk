/**

 * Basemap — auto (satelit kur zoom in) / OSM / Google Satellite + tema

 */



const BASEMAP_MODE_KEY = "tkkBasemapMode";



let basemapMode = "auto";

let syncBasemapImpl = null;

let basemapMap = null;

let basemapOsmLayerLight = null;

let basemapOsmLayerDark = null;

let basemapOsmLayer = null;

let basemapSatelliteLayer = null;

let basemapSatelliteFallbackLayer = null;

let activeSatelliteLayer = null;

let googleSatelliteFailed = false;

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



function getSatelliteOnZoom() {

  return typeof SATELLITE_AUTO_MIN_ZOOM === "number"

    ? SATELLITE_AUTO_MIN_ZOOM

    : 11;

}



function getSatelliteOffZoom() {

  return typeof SATELLITE_AUTO_OFF_ZOOM === "number"

    ? SATELLITE_AUTO_OFF_ZOOM

    : getSatelliteOnZoom() - 1;

}



/** Auto: satelit kur zoom >= 11; fiket kur zoom <= 10 (histerzisë) */

function shouldShowSatelliteAuto(map) {

  if (!map || typeof map.getZoom !== "function") return false;



  const z = map.getZoom();

  const onZ = getSatelliteOnZoom();

  const offZ = getSatelliteOffZoom();



  if (satelliteShownInAuto) {

    return z > offZ;

  }

  return z >= onZ;

}



function setSatelliteLayerOpacity(layer) {

  if (!layer) return;

  layer.setOpacity(

    typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1

  );

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

  basemapOsmLayerLight.redraw?.();

  basemapOsmLayerDark.redraw?.();

}



function getActiveOsmLayer() {

  return isLightTheme() ? basemapOsmLayerLight : basemapOsmLayerDark;

}



function getInactiveOsmLayer() {

  return isLightTheme() ? basemapOsmLayerDark : basemapOsmLayerLight;

}



function hideAllOsmLayers() {

  if (!basemapMap) return;

  [basemapOsmLayerLight, basemapOsmLayerDark].forEach((layer) => {

    if (layer && basemapMap.hasLayer(layer)) {

      basemapMap.removeLayer(layer);

    }

  });

}



function mountActiveOsmLayer() {

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

  active.setOpacity(1);

  active.bringToBack?.();

}



function applyBasemapTileUrls() {

  updatePairedOsmLayerUrls();

  if (basemapSatelliteLayer) {

    const url = getSatelliteTileUrl();

    if (basemapSatelliteLayer._url !== url) {

      basemapSatelliteLayer.setUrl(url);

    }

    basemapSatelliteLayer.redraw?.();

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

  syncBasemap();

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



  hideAllOsmLayers();



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



  layer.bringToFront?.();

}



function ensureSatelliteVisible() {

  if (!basemapMap) return;

  useSatelliteLayer(pickSatelliteLayer());

  satelliteShownInAuto = true;

  window.tkkSatelliteActive = true;

}



function ensureOsmVisible() {

  if (!basemapMap) return;

  clearSatellite();

  satelliteShownInAuto = false;

  window.tkkSatelliteActive = false;

  mountActiveOsmLayer();

}



function syncBasemap() {

  if (!basemapMap) return;



  const theme = isLightTheme() ? "light" : "dark";

  const tileKey = basemapMode + "|" + theme;

  if (tileKey !== lastBasemapTileKey) {

    lastBasemapTileKey = tileKey;

    applyBasemapTileUrls();

  }



  const wantSat = shouldUseSatelliteBasemap(basemapMap);

  if (wantSat) {

    ensureSatelliteVisible();

  } else {

    ensureOsmVisible();

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

  satelliteShownInAuto = false;

  lastBasemapTileKey = "";

  if (syncBasemapImpl) {

    syncBasemapImpl();

  } else {

    syncBasemap();

  }

  notifyBasemapModeChange();

}



function createSatelliteTileLayer(url) {

  const isProxy = String(url).indexOf("/google-tiles/") !== -1;

  return L.tileLayer(url, {

    pane: "basemapSatellitePane",

    attribution: GOOGLE_SATELLITE_ATTRIBUTION,

    subdomains: isProxy ? "" : GOOGLE_SATELLITE_SUBDOMAINS,

    maxZoom: 20,

    detectRetina: false,

    opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,

  });

}



function switchToFallbackSatellite() {

  if (!basemapSatelliteFallbackLayer || !basemapMap) return;

  googleSatelliteFailed = true;

  if (shouldUseSatelliteBasemap(basemapMap)) {

    useSatelliteLayer(basemapSatelliteFallbackLayer);

    satelliteShownInAuto = true;

    window.tkkSatelliteActive = true;

  }

}



function initMapBasemaps(map) {

  basemapMap = map;



  if (!map.getPane("basemapSatellitePane")) {

    map.createPane("basemapSatellitePane");

    map.getPane("basemapSatellitePane").style.zIndex = "210";

  }



  createPairedOsmLayers();

  mountActiveOsmLayer();



  const satUrl = getSatelliteTileUrl();

  basemapSatelliteLayer = createSatelliteTileLayer(satUrl);

  basemapSatelliteFallbackLayer = L.tileLayer(

    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

    {

      attribution: "Tiles &copy; Esri",

      maxZoom: 19,

      pane: "basemapSatellitePane",

      opacity: typeof SATELLITE_LAYER_OPACITY === "number" ? SATELLITE_LAYER_OPACITY : 1,

    }

  );



  let googleErrors = 0;

  basemapSatelliteLayer.on("tileload", () => {

    googleErrors = 0;

  });



  basemapSatelliteLayer.on("tileerror", () => {

    if (basemapMode === "osm" || googleSatelliteFailed) return;

    googleErrors += 1;

    if (googleErrors >= 2) {

      console.warn(

        "Google Satellite: pllaka dështuan — përdor Esri Imagery (HAPNI.bat për Google)."

      );

      switchToFallbackSatellite();

    }

  });



  syncBasemapImpl = syncBasemap;

  lastBasemapTileKey = "";

  syncBasemap();



  map.on("zoom", syncBasemap);

  map.on("zoomend", syncBasemap);

  map.on("moveend", syncBasemap);

  map.whenReady(() => {

    syncBasemap();

    setTimeout(syncBasemap, 100);

  });



  window.getScaleBarMeters = getScaleBarMeters;

  window.shouldShowSatellite = (m) => shouldShowSatelliteAuto(m || map);

  window.tkkBasemapOsm = basemapOsmLayer;

  window.tkkBasemapDark = basemapOsmLayerDark;

  window.tkkBasemapSatellite = basemapSatelliteLayer;

  window.syncBasemapForZoom = syncBasemap;

  window.getBasemapMode = getBasemapMode;

  window.setBasemapMode = setBasemapMode;

  window.tkkSatelliteActive = false;

}



window.getBasemapMode = getBasemapMode;

window.setBasemapMode = setBasemapMode;

window.applyThemeToBasemap = applyThemeToBasemap;



window.addEventListener("tkk:theme-change", () => {

  applyThemeToBasemap();

});


