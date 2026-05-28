function createWmsLayer(layerName, styleOpts) {
  if (window.tkkIsStaticPublish || !WMS_URL) {
    return L.layerGroup();
  }
  const opts = {
    layers: layerName,
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    srs: "EPSG:3857",
    ...(styleOpts || {}),
  };
  return L.tileLayer.wms(WMS_URL, opts);
}

const monumentRegistry = [];
window.monumentRegistry = monumentRegistry;
window.allMonumentFeatures = [];
window.tkkClusterGroups = [];

function wfsPointToLonLat(feature) {
  const p = feature.properties || {};
  const latP = parseFloat(p.lat);
  const lonP = parseFloat(p.lon);
  if (!Number.isNaN(latP) && !Number.isNaN(lonP)) {
    return [lonP, latP];
  }

  const g = feature.geometry;
  if (!g || g.type !== "Point" || !g.coordinates?.length) return null;

  let lon = Number(g.coordinates[0]);
  let lat = Number(g.coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    const r = 6378137;
    lon = (lon / r) * (180 / Math.PI);
    lat = (Math.atan(Math.exp(lat / r)) * 2 - Math.PI / 2) * (180 / Math.PI);
  }

  return [lon, lat];
}

const STATIC_MONUMENT_GEOJSON = {
  arkeologjike: "data/monuments/arkeologjike.geojson",
  arkitekturore: "data/monuments/arkitekturore.geojson",
  luajtshme: "data/monuments/luajtshme.geojson",
};

function ingestMonumentFeatures(rawFeatures, typeKey, clusterGroup) {
  const features = (rawFeatures || [])
    .map((f) => {
      const coords = wfsPointToLonLat(f);
      if (!coords) return null;
      return {
        ...f,
        geometry: { type: "Point", coordinates: coords },
      };
    })
    .filter(Boolean);

  if (!features.length) {
    console.warn("Monumente: asnjë pikë me koordinata —", typeKey);
  }

  features.forEach((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const latlng = L.latLng(lat, lon);
    const marker = createMonumentMarker(latlng, typeKey, feature);
    marker.feature = feature;

    marker.on("click", (ev) => {
      if (ev?.originalEvent) {
        L.DomEvent.stopPropagation(ev.originalEvent);
      }
      if (typeof handleMonumentMarkerClick === "function") {
        handleMonumentMarkerClick(latlng, feature, typeKey);
      } else if (typeof showDetailPanel === "function") {
        showDetailPanel(feature);
        map.panTo(latlng, { animate: true });
      }
    });

    monumentRegistry.push({ layer: marker, feature, cluster: clusterGroup });
    clusterGroup.addLayer(marker);
  });

  return features;
}

function loadStaticMonumentGeoJson(typeKey, clusterGroup) {
  const url = STATIC_MONUMENT_GEOJSON[typeKey];
  if (!url) return Promise.resolve([]);

  const base =
    typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "";
  return fetch(base + url, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("GeoJSON " + typeKey + ": HTTP " + response.status);
      }
      return response.json();
    })
    .then((data) => ingestMonumentFeatures(data.features || [], typeKey, clusterGroup))
    .catch((err) => {
      console.error("GeoJSON gabim:", typeKey, err);
      throw err;
    });
}

function loadWfsLayer(typeName, typeKey, clusterGroup) {
  if (!WFS_URL) {
    return Promise.resolve([]);
  }
  const url =
    WFS_URL +
    "?service=WFS&version=1.0.0&request=GetFeature" +
    "&typeName=" +
    encodeURIComponent(typeName) +
    "&outputFormat=application/json" +
    "&srsName=EPSG:4326";

  return fetch(url)
    .then(async (response) => {
      const ct = response.headers.get("content-type") || "";
      const text = await response.text();
      if (!response.ok) {
        throw new Error("WFS HTTP " + response.status + " — " + typeName);
      }
      if (!ct.includes("json") && text.trim().startsWith("<")) {
        throw new Error(
          "WFS nuk u lexua (proxy mungon). Përdor HAPNI.bat ose node serve.js në folderin web."
        );
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("WFS JSON i pavlefshëm — " + typeName);
      }
      return data;
    })
    .then((data) =>
      ingestMonumentFeatures(data.features || [], typeKey, clusterGroup)
    )
    .catch((err) => {
      console.error("WFS gabim:", typeName, err);
      return [];
    });
}

const map = L.map("map", {
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  minZoom: 7,
  maxZoom: 20,
  zoomControl: false,
});

window.map = map;

if (!map.getPane("adminLabelsPane")) {
  map.createPane("adminLabelsPane");
  map.getPane("adminLabelsPane").style.zIndex = 480;
}

function initScaleLayerPrefs() {
  if (window._tkkLayerPrefs) return;
  const kIn = document.querySelector('input[data-layer="komunat"]');
  const rIn = document.querySelector('input[data-layer="rajonet"]');
  window._tkkLayerPrefs = {
    komunat: kIn ? kIn.defaultChecked : true,
    rajonet: rIn ? rIn.defaultChecked : true,
  };
}

initScaleLayerPrefs();

const clusterArkeologjike = createTypeClusterGroup("arkeologjike");
const clusterArkitekturore = createTypeClusterGroup("arkitekturore");
const clusterLuajtshme = createTypeClusterGroup("luajtshme");

window.tkkClusterGroups = [
  clusterArkeologjike,
  clusterArkitekturore,
  clusterLuajtshme,
];

clusterArkeologjike.addTo(map);
clusterArkitekturore.addTo(map);
clusterLuajtshme.addTo(map);

function startMonumentWfsLoad() {
  if (window._tkkMonumentsLoadStarted) return;
  window._tkkMonumentsLoadStarted = true;

  const monumentLoads = window.tkkIsStaticPublish
    ? [
        loadStaticMonumentGeoJson("arkeologjike", clusterArkeologjike),
        loadStaticMonumentGeoJson("arkitekturore", clusterArkitekturore),
        loadStaticMonumentGeoJson("luajtshme", clusterLuajtshme),
      ]
    : [
        loadWfsLayer(
          WFS_LAYERS.arkeologjike,
          "arkeologjike",
          clusterArkeologjike
        ),
        loadWfsLayer(
          WFS_LAYERS.arkitekturore,
          "arkitekturore",
          clusterArkitekturore
        ),
        loadWfsLayer(WFS_LAYERS.luajtshme, "luajtshme", clusterLuajtshme),
      ];

  Promise.all(monumentLoads)
    .then((results) => {
      const flat = results.flat();
      flat.forEach((f) => window.allMonumentFeatures.push(f));
      window.tkkMonumentCount = flat.length;

      (window.tkkClusterGroups || []).forEach((cg) => {
        if (!map.hasLayer(cg)) map.addLayer(cg);
        if (typeof bindClusterPicker === "function") bindClusterPicker(cg);
      });

      (window.monumentRegistry || []).forEach(({ layer, cluster }) => {
        if (typeof setMarkerVisible === "function") {
          setMarkerVisible(layer, cluster, true);
        }
      });

      if (typeof setPeriodFilter === "function") {
        setPeriodFilter("all");
      } else if (typeof applyPeriodFilterToMap === "function") {
        applyPeriodFilterToMap();
      }

      if (typeof refreshAllClusters === "function") refreshAllClusters();
      map.invalidateSize();

      if (typeof updatePeriudhaChart === "function") {
        updatePeriudhaChart(window.allMonumentFeatures);
      }
      if (typeof initPeriodFilters === "function") initPeriodFilters();
      if (typeof initTimeline === "function") initTimeline();
      if (typeof initSidebar === "function") initSidebar();
      if (typeof updateLayerCounts === "function") updateLayerCounts();
      if (typeof refreshMonumentSymbology === "function") {
        refreshMonumentSymbology();
      }

      if (typeof window.tkkOnMonumentsLoaded === "function") {
        window.tkkOnMonumentsLoaded(flat.length);
      }
    })
    .catch((e) => {
      console.error("WFS/grafik:", e);
      if (typeof window.tkkOnMonumentsLoadError === "function") {
        window.tkkOnMonumentsLoadError(e);
      }
    });
}

L.control
  .zoom({
    position: "topleft",
    zoomInTitle: typeof t === "function" ? t("map.zoomIn") : "Zmadho",
    zoomOutTitle: typeof t === "function" ? t("map.zoomOut") : "Zvogëlo",
  })
  .addTo(map);

function updateMapZoomI18n() {
  const zoomIn = document.querySelector(".leaflet-control-zoom-in");
  const zoomOut = document.querySelector(".leaflet-control-zoom-out");
  if (zoomIn) zoomIn.title = t("map.zoomIn");
  if (zoomOut) zoomOut.title = t("map.zoomOut");
}

window.updateMapZoomI18n = updateMapZoomI18n;

const rajonetLabelsLayer = L.layerGroup();
const rajonetBordersLayer = L.layerGroup();
const rajonetLayer = L.layerGroup([rajonetBordersLayer, rajonetLabelsLayer]);
let rajonetWmsLayer = null;

const RAJONET_WFS_TYPE_NAMES =
  (typeof WFS_LAYER_ALIASES !== "undefined" && WFS_LAYER_ALIASES.rajonet) ||
  [WMS_LAYERS.rajonet];

function formatRajonDisplayName(raw) {
  return String(raw).trim().replace(/\s+/g, " ");
}

function getRajonLabelRaw(properties) {
  const p = properties || {};
  const raw = p.Rajoni ?? p.rajoni;
  if (raw == null || !String(raw).trim()) return null;
  return formatRajonDisplayName(raw);
}

function getRajonMapLabel(rawName) {
  if (!rawName) return null;
  if (typeof translateRajonDisplayName === "function") {
    return translateRajonDisplayName(rawName);
  }
  return rawName;
}

function rajonLabelHtml(name) {
  const safe = String(name)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return '<span class="rajon-label">' + safe + "</span>";
}

const RAJON_LABEL_CENTERS = {
  "rajoni i prishtinës": [42.583, 21.055],
  "rajoni i prishtines": [42.583, 21.055],
};

function normalizeRegionKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

function getRajonLabelPosition(name, features) {
  const key = normalizeRegionKey(name);
  if (RAJON_LABEL_CENTERS[key]) {
    const pair = RAJON_LABEL_CENTERS[key];
    return L.latLng(pair[0], pair[1]);
  }
  return geoJsonFeaturesCenter(features);
}

function createRajonLabelMarker(latlng, name) {
  return L.marker(latlng, {
    pane: "adminLabelsPane",
    zIndexOffset: -400,
    icon: L.divIcon({
      className: "rajon-label-marker",
      html: rajonLabelHtml(name),
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  });
}

function geoJsonFeaturesCenter(features) {
  try {
    const group = L.featureGroup();
    (features || []).forEach((feature) => {
      group.addLayer(L.geoJSON(feature, { interactive: false }));
    });
    if (!group.getLayers().length) return null;
    return group.getBounds().getCenter();
  } catch {
    return null;
  }
}

function applyRajonetLabelsGeoJson(data) {
  window._tkkRajonetLabelsGeoJson = data;
  rajonetLabelsLayer.clearLayers();
  const byRegion = new Map();

  (data.features || []).forEach((feature) => {
    const rawName = getRajonLabelRaw(feature.properties);
    if (!rawName) return;
    if (!byRegion.has(rawName)) byRegion.set(rawName, []);
    byRegion.get(rawName).push(feature);
  });

  byRegion.forEach((features, rawName) => {
    const center = getRajonLabelPosition(rawName, features);
    if (!center) return;
    const label = getRajonMapLabel(rawName);
    rajonetLabelsLayer.addLayer(createRajonLabelMarker(center, label));
  });
}

function refreshRajonetLabelsI18n() {
  const data = window._tkkRajonetLabelsGeoJson;
  if (!data?.features?.length) return;
  applyRajonetLabelsGeoJson(data);
  if (typeof syncRajonLabelVisibility === "function") {
    syncRajonLabelVisibility();
  }
}

window.refreshRajonetLabelsI18n = refreshRajonetLabelsI18n;

function addRajonetWmsToGroup() {
  if (rajonetWmsLayer) return rajonetWmsLayer;
  const z = ADMIN_LAYER_Z_INDEX.rajonet;
  rajonetWmsLayer = createWmsLayer(
    WMS_LAYERS.rajonet,
    Object.assign({ zIndex: z }, POLYGON_WMS_STYLE.rajonet)
  );
  if (rajonetWmsLayer.setZIndex) rajonetWmsLayer.setZIndex(z);
  rajonetBordersLayer.addLayer(rajonetWmsLayer);
  return rajonetWmsLayer;
}

function getRajonetVectorStyle() {
  const base =
    typeof RAJONET_STYLE !== "undefined"
      ? RAJONET_STYLE
      : { color: "#b8a574", weight: 1.75, opacity: 0.72, fill: false, fillOpacity: 0 };
  const light = typeof getTheme === "function" && getTheme() === "light";
  if (!light) return base;
  return Object.assign({}, base, {
    color: "#8b6914",
    opacity: 0.88,
  });
}

function applyRajonetGeoJson(data) {
  rajonetBordersLayer.clearLayers();
  rajonetWmsLayer = null;
  const regions = L.geoJSON(data, {
    style: getRajonetVectorStyle(),
    interactive: false,
  });
  rajonetBordersLayer.addLayer(regions);
  applyRajonetLabelsGeoJson(data);
  orderAdminBoundaryLayers();
  if (typeof syncRajonetLayersForZoom === "function") {
    syncRajonetLayersForZoom();
  }
}

function fetchRajonetWfs(typeName) {
  const url =
    WFS_URL +
    "?service=WFS&version=1.0.0&request=GetFeature" +
    "&typeName=" +
    encodeURIComponent(typeName) +
    "&outputFormat=application/json" +
    "&srsName=EPSG:4326";

  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("WFS " + typeName + ": " + response.status);
    return response.json();
  });
}

function tryLoadRajonetWfs(index) {
  if (index >= RAJONET_WFS_TYPE_NAMES.length) {
    console.warn("Rajonet WFS: asnjë emër shtrese nuk u gjet, përdoret WMS.");
    return;
  }

  const typeName = RAJONET_WFS_TYPE_NAMES[index];
  fetchRajonetWfs(typeName)
    .then((data) => {
      if (!data.features?.length) {
        throw new Error("pa geometri");
      }
      applyRajonetGeoJson(data);
    })
    .catch(() => tryLoadRajonetWfs(index + 1));
}

const RAJON_LABEL_WFS_NAMES = Array.from(
  new Set(
    []
      .concat(
        (typeof WFS_LAYER_ALIASES !== "undefined" && WFS_LAYER_ALIASES.komunat) ||
          [WMS_LAYERS.komunat],
        RAJONET_WFS_TYPE_NAMES
      )
      .filter(Boolean)
  )
);

function loadRajonetLabels() {
  tryLoadRajonetLabelsOnly(0);
  setTimeout(() => {
    if (!rajonetLabelsLayer.getLayers().length) {
      tryLoadRajonetLabelsOnly(0);
    }
  }, 2500);
}

function tryLoadRajonetLabelsOnly(index) {
  if (index >= RAJON_LABEL_WFS_NAMES.length) {
    console.warn("Rajonet WFS: emrat e rajoneve nuk u ngarkuan.");
    return;
  }

  const typeName = RAJON_LABEL_WFS_NAMES[index];
  fetchRajonetWfs(typeName)
    .then((data) => {
      if (!data.features?.length) throw new Error("pa geometri");
      applyRajonetLabelsGeoJson(data);
      if (typeof syncRajonetLayersForZoom === "function") {
        syncRajonetLayersForZoom();
      } else {
        syncRajonLabelVisibility();
      }
    })
    .catch(() => tryLoadRajonetLabelsOnly(index + 1));
}

function getMapScaleMeters() {
  if (map && typeof getScaleBarMeters === "function") {
    return getScaleBarMeters(map);
  }
  return null;
}

/** Komunat + emrat: shfaqen kur shkalla < ~9 km (zoom i afërt / satelit) */
function isKomunatDetailScale() {
  const m = getMapScaleMeters();
  if (m != null) {
    const threshold =
      typeof SATELLITE_AUTO_ON_MAX_METERS === "number"
        ? SATELLITE_AUTO_ON_MAX_METERS
        : typeof SATELLITE_MAX_SCALE_METERS === "number"
          ? SATELLITE_MAX_SCALE_METERS * 0.9
          : 9000;
    return m < threshold;
  }
  if (!map || typeof map.getZoom !== "function") return false;
  const minZoom =
    typeof KOMUNAT_MIN_ZOOM === "number" ? KOMUNAT_MIN_ZOOM : 9;
  return map.getZoom() >= minZoom;
}

/** Rajonet: pamje e gjerë (shkallë >= 10 km), fshihen kur shfaqen komunat */
function isRajonetOverviewScale() {
  if (isKomunatDetailScale()) return false;
  const m = getMapScaleMeters();
  if (m != null) {
    const minOverview =
      typeof SATELLITE_MAX_SCALE_METERS === "number"
        ? SATELLITE_MAX_SCALE_METERS
        : 10000;
    return m >= minOverview;
  }
  if (typeof shouldShowSatellite === "function" && shouldShowSatellite(map)) {
    return false;
  }
  if (!map || typeof map.getZoom !== "function") return true;
  const minK =
    typeof KOMUNAT_MIN_ZOOM === "number" ? KOMUNAT_MIN_ZOOM : 9;
  return map.getZoom() < minK;
}

function shouldShowRajonLabels() {
  const m = getMapScaleMeters();
  if (m == null) return true;
  const maxScale =
    typeof RAJON_LABEL_MAX_SCALE_METERS !== "undefined"
      ? RAJON_LABEL_MAX_SCALE_METERS
      : 30000;
  return m <= maxScale;
}

function syncRajonLabelVisibility() {
  if (!rajonetLayer || !rajonetLabelsLayer || !map.hasLayer(rajonetLayer)) {
    return;
  }

  const showLabels = shouldShowRajonLabels();
  const labelsOnLayer = rajonetLayer.hasLayer(rajonetLabelsLayer);

  if (showLabels && !labelsOnLayer) {
    rajonetLayer.addLayer(rajonetLabelsLayer);
  } else if (!showLabels && labelsOnLayer) {
    rajonetLayer.removeLayer(rajonetLabelsLayer);
  }
}

function updateLayerRowVisual(key, effectiveOn) {
  const input = document.querySelector('input[data-layer="' + key + '"]');
  const row = document.querySelector('.layer-row[data-layer="' + key + '"]');
  if (!input || !row) return;
  input.checked = effectiveOn;
  row.classList.toggle("is-off", !effectiveOn);
}

function syncRajonetLayersForZoom() {
  syncScaleDependentAdminLayers();
}

const STATIC_BOUNDARY_GEOJSON = {
  kosova: "data/boundaries/kosova.geojson",
  rajonet: "data/boundaries/rajonet.geojson",
  komunat: "data/boundaries/komunat.geojson",
};

function fetchStaticBoundaryGeoJson(key) {
  const url = STATIC_BOUNDARY_GEOJSON[key];
  if (!url) return Promise.reject(new Error("missing key"));
  const base =
    typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "";
  return fetch(base + url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(key + " HTTP " + r.status);
    return r.json();
  });
}

function loadStaticAdminBoundaries() {
  const kosovaP = fetchStaticBoundaryGeoJson("kosova")
    .then((data) => {
      if (!data.features?.length) throw new Error("kosova bosh");
      const border = L.geoJSON(data, {
        style: KOSOVA_BORDER_STYLE,
        interactive: false,
      });
      kosovaLayer.addLayer(border);
    })
    .catch((err) => console.warn("Kufiri Kosovës (statik):", err));

  const rajonetP = fetchStaticBoundaryGeoJson("rajonet")
    .then((data) => {
      if (!data.features?.length) throw new Error("rajonet bosh");
      applyRajonetGeoJson(data);
    })
    .catch((err) => console.warn("Rajonet (statik):", err));

  const komunatP = fetchStaticBoundaryGeoJson("komunat")
    .then((data) => {
      if (!data.features?.length) throw new Error("komunat bosh");
      const polys = L.geoJSON(data, {
        style:
          typeof KOMUNAT_VECTOR_STYLE !== "undefined"
            ? KOMUNAT_VECTOR_STYLE
            : getRajonetVectorStyle(),
        interactive: false,
      });
      if (polys.setZIndex) polys.setZIndex(ADMIN_LAYER_Z_INDEX.komunat);
      komunatBordersLayer.addLayer(polys);
      applyKomunatLabelsGeoJson(data);
    })
    .catch((err) => console.warn("Komunat (statik):", err));

  Promise.all([kosovaP, rajonetP, komunatP]).then(() => {
    if (typeof syncScaleDependentAdminLayers === "function") {
      syncScaleDependentAdminLayers();
    } else {
      orderAdminBoundaryLayers();
    }
  });
}

function loadRajonetLayer() {
  if (window.tkkIsStaticPublish) {
    loadStaticAdminBoundaries();
    return;
  }
  if (!WFS_URL) return;
  addRajonetWmsToGroup();
  tryLoadRajonetWfs(0);
  loadRajonetLabels();
}

function tkkRajonetShouldShowOnMap() {
  const prefs = window._tkkLayerPrefs || {};
  return prefs.rajonet !== false && isRajonetOverviewScale();
}

function tkkKomunatShouldShowOnMap() {
  const prefs = window._tkkLayerPrefs || {};
  return prefs.komunat !== false && isKomunatDetailScale();
}

function orderAdminBoundaryLayers() {
  const zR = ADMIN_LAYER_Z_INDEX.rajonet;
  const zK = ADMIN_LAYER_Z_INDEX.komunat;
  const zKo = ADMIN_LAYER_Z_INDEX.kosova;

  const showRajonet = tkkRajonetShouldShowOnMap();
  const showKomunat = tkkKomunatShouldShowOnMap();
  const showKosova = kosovaLayer.getLayers().length > 0;

  if (map.hasLayer(rajonetLayer)) map.removeLayer(rajonetLayer);
  if (map.hasLayer(window.tkkKomunatLayer)) map.removeLayer(window.tkkKomunatLayer);
  if (map.hasLayer(kosovaLayer)) map.removeLayer(kosovaLayer);

  if (showRajonet) {
    map.addLayer(rajonetLayer);
    rajonetLayer.eachLayer?.((child) => {
      if (child.setZIndex) child.setZIndex(zR);
    });
    syncRajonLabelVisibility();
  }

  if (showKomunat) {
    map.addLayer(window.tkkKomunatLayer);
    window.tkkKomunatLayer.eachLayer?.((child) => {
      if (child.setZIndex) child.setZIndex(zK);
    });
    syncKomunaLabelVisibility();
  }

  if (showKosova) {
    map.addLayer(kosovaLayer);
    kosovaLayer.eachLayer?.((child) => {
      if (child.setZIndex) child.setZIndex(zKo);
    });
  }

  (window.tkkClusterGroups || []).forEach((cg) => {
    if (map.hasLayer(cg) && typeof cg.bringToFront === "function") {
      cg.bringToFront();
    }
  });
}

const komunatBordersLayer = L.layerGroup();
const komunatLabelsLayer = L.layerGroup();
const wmsKomunat = createWmsLayer(
  WMS_LAYERS.komunat,
  Object.assign({ zIndex: ADMIN_LAYER_Z_INDEX.komunat }, POLYGON_WMS_STYLE.komunat)
);
komunatBordersLayer.addLayer(wmsKomunat);
const komunatLayer = L.layerGroup([komunatBordersLayer, komunatLabelsLayer]);

const KOMUNAT_WFS_TYPE_NAMES =
  (typeof WFS_LAYER_ALIASES !== "undefined" && WFS_LAYER_ALIASES.komunat) ||
  [WMS_LAYERS.komunat];

function formatKomunaDisplayName(raw) {
  let s = String(raw).trim();
  s = s.replace(/^Municipality of\s+/i, "");
  s = s.replace(/^Komuna e\s+/i, "");
  s = s.replace(/^Bashkia e\s+/i, "");
  return s.trim() || String(raw).trim();
}

function getKomunaLabel(properties) {
  const p = properties || {};
  const fields =
    typeof KOMUNA_LABEL_FIELDS !== "undefined"
      ? KOMUNA_LABEL_FIELDS
      : ["shapeName", "emri", "name", "komuna"];
  for (let i = 0; i < fields.length; i++) {
    const v = p[fields[i]];
    if (v != null && String(v).trim()) return formatKomunaDisplayName(v);
  }
  const fuzzy = Object.keys(p).find((k) =>
    /^(shapename|emri|name|komuna|municip)/i.test(k)
  );
  if (fuzzy && p[fuzzy]) return formatKomunaDisplayName(p[fuzzy]);
  return null;
}

function komunaLabelHtml(name) {
  const safe = String(name)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return '<span class="komuna-label">' + safe + "</span>";
}

function geoJsonFeatureCenter(feature) {
  try {
    return L.geoJSON(feature).getBounds().getCenter();
  } catch {
    return null;
  }
}

function createKomunaLabelMarker(latlng, name) {
  return L.marker(latlng, {
    pane: "adminLabelsPane",
    zIndexOffset: -400,
    icon: L.divIcon({
      className: "komuna-label-marker",
      html: komunaLabelHtml(name),
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  });
}

function applyKomunatLabelsGeoJson(data) {
  komunatLabelsLayer.clearLayers();
  (data.features || []).forEach((feature) => {
    const name = getKomunaLabel(feature.properties);
    if (!name) return;
    const center = geoJsonFeatureCenter(feature);
    if (!center) return;
    komunatLabelsLayer.addLayer(createKomunaLabelMarker(center, name));
  });
}

function fetchKomunatWfs(typeName) {
  const url =
    WFS_URL +
    "?service=WFS&version=1.0.0&request=GetFeature" +
    "&typeName=" +
    encodeURIComponent(typeName) +
    "&outputFormat=application/json" +
    "&srsName=EPSG:4326";

  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("WFS " + typeName + ": " + response.status);
    return response.json();
  });
}

function loadKomunatLabels() {
  if (window.tkkIsStaticPublish || !WFS_URL) return;
  tryLoadKomunatLabels(0);
  setTimeout(() => {
    if (!komunatLabelsLayer.getLayers().length) {
      tryLoadKomunatLabels(0);
    }
  }, 2500);
}

function tryLoadKomunatLabels(index) {
  if (index >= KOMUNAT_WFS_TYPE_NAMES.length) {
    console.warn("Komunat WFS: emrat e komunave nuk u ngarkuan.");
    return;
  }

  const typeName = KOMUNAT_WFS_TYPE_NAMES[index];
  fetchKomunatWfs(typeName)
    .then((data) => {
      if (!data.features?.length) throw new Error("pa geometri");
      applyKomunatLabelsGeoJson(data);
      if (typeof syncKomunatLayersForZoom === "function") {
        syncKomunatLayersForZoom();
      }
    })
    .catch(() => tryLoadKomunatLabels(index + 1));
}

function syncKomunaLabelVisibility() {
  const layer = window.tkkKomunatLayer;
  if (!layer || !komunatLabelsLayer || !map.hasLayer(layer)) return;

  if (!layer.hasLayer(komunatBordersLayer) && komunatBordersLayer.getLayers().length) {
    layer.addLayer(komunatBordersLayer);
  }
  if (!layer.hasLayer(komunatLabelsLayer) && komunatLabelsLayer.getLayers().length) {
    layer.addLayer(komunatLabelsLayer);
  }
}

function syncKomunatLayersForZoom() {
  syncScaleDependentAdminLayers();
}

function syncScaleDependentAdminLayers() {
  orderAdminBoundaryLayers();

  const prefs = window._tkkLayerPrefs || {};
  const userOnK = prefs.komunat !== false;
  const userOnR = prefs.rajonet !== false;
  const showK = tkkKomunatShouldShowOnMap();
  const showR = tkkRajonetShouldShowOnMap();

  updateLayerRowVisual("komunat", userOnK);
  updateLayerRowVisual("rajonet", userOnR);

  const rowK = document.querySelector('.layer-row[data-layer="komunat"]');
  if (rowK) rowK.classList.toggle("is-scale-hidden", userOnK && !showK);

  const rowR = document.querySelector('.layer-row[data-layer="rajonet"]');
  if (rowR) rowR.classList.toggle("is-scale-hidden", userOnR && !showR);
}

window.tkkRajonetLayer = rajonetLayer;
window.tkkKomunatLayer = komunatLayer;
window.tkkKomunatBordersLayer = komunatBordersLayer;
window.tkkKomunatLabelsLayer = komunatLabelsLayer;
window.syncKomunatLayersForZoom = syncKomunatLayersForZoom;
window.syncRajonetLayersForZoom = syncRajonetLayersForZoom;
window.syncScaleDependentAdminLayers = syncScaleDependentAdminLayers;

function tkkInitBasemapsSafe() {
  try {
    if (typeof initMapBasemaps === "function") {
      initMapBasemaps(map);
    }
  } catch (err) {
    console.error("initMapBasemaps:", err);
  }
}

function tkkEnsureBasemapsReady(attempt) {
  tkkInitBasemapsSafe();
  if (typeof window.syncBasemapForZoom === "function" && window.tkkBasemapOsm) {
    window.syncBasemapForZoom();
    return;
  }
  if ((attempt || 0) < 15) {
    setTimeout(() => tkkEnsureBasemapsReady((attempt || 0) + 1), 150);
  }
}

tkkEnsureBasemapsReady(0);
map.whenReady(() => tkkEnsureBasemapsReady(0));

const kosovaLayer = L.layerGroup();
kosovaLayer.addTo(map);

function loadKosovaBorderLayer() {
  if (window.tkkIsStaticPublish || !WFS_URL) return;

  return fetchStaticBoundaryGeoJson("kosova")
    .then((data) => {
      if (!data.features?.length) throw new Error("kosova.geojson bosh");
      const border = L.geoJSON(data, {
        style: KOSOVA_BORDER_STYLE,
        interactive: false,
      });
      kosovaLayer.addLayer(border);
    })
    .catch((err) => {
      console.warn("Kufiri Kosovës (GeoJSON statik):", err);
      const wms = createWmsLayer(
        WMS_LAYERS.kosova,
        Object.assign({ zIndex: ADMIN_LAYER_Z_INDEX.kosova }, POLYGON_WMS_STYLE.kosova)
      );
      if (wms.setZIndex) wms.setZIndex(ADMIN_LAYER_Z_INDEX.kosova);
      kosovaLayer.addLayer(wms);
    })
    .finally(() => orderAdminBoundaryLayers());
}

if (wmsKomunat.setZIndex) wmsKomunat.setZIndex(ADMIN_LAYER_Z_INDEX.komunat);
if (!window.tkkIsStaticPublish) {
  loadKomunatLabels();
  loadKosovaBorderLayer();
}
loadRajonetLayer();

const layerMap = {
  rajonet: rajonetLayer,
  komunat: komunatLayer,
  kosova: kosovaLayer,
  arkeologjike: clusterArkeologjike,
  arkitekturore: clusterArkitekturore,
  luajtshme: clusterLuajtshme,
};

window._tkkLayerPrefs = window._tkkLayerPrefs || {
  komunat: true,
  rajonet: true,
};

document.querySelectorAll("input[data-layer]").forEach((input) => {
  const key = input.dataset.layer;
  const layer = layerMap[key];
  if (!layer) return;
  input.addEventListener("change", () => {
    if (key === "komunat" || key === "rajonet") {
      if (!window._tkkLayerPrefs) window._tkkLayerPrefs = {};
      window._tkkLayerPrefs[key] = input.checked;
      syncScaleDependentAdminLayers();
      return;
    }
    if (input.checked) {
      map.addLayer(layer);
    } else {
      map.removeLayer(layer);
    }
    if (key === "kosova") {
      orderAdminBoundaryLayers();
    }
  });
});

function tkkOnMapZoomBasemap() {
  if (typeof window.syncBasemapForZoom === "function") {
    window.syncBasemapForZoom();
  }
}

map.on("zoomstart", syncScaleDependentAdminLayers);
map.on("zoom", syncScaleDependentAdminLayers);
map.on("zoomend", syncScaleDependentAdminLayers);
map.on("moveend", syncScaleDependentAdminLayers);
map.on("zoom", tkkOnMapZoomBasemap);
map.on("zoomend", ttkOnMapZoomBasemap);
map.whenReady(() => {
  initScaleLayerPrefs();
  syncScaleDependentAdminLayers();
});

const coordsEl = document.getElementById("mapCoords");
map.on("mousemove", (e) => {
  window.lastMapLatLng = e.latlng;
  if (!coordsEl) return;
  coordsEl.textContent =
    typeof window.formatMapCoords === "function"
      ? window.formatMapCoords(e.latlng)
      : "WGS84: " + e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5);
});

L.control
  .scale({
    imperial: false,
    position: "bottomleft",
    maxWidth: 96,
  })
  .addTo(map);

map.whenReady(() => {
  setTimeout(startMonumentWfsLoad, 50);
});

if (typeof initMapTools === "function") initMapTools();
