/**
 * filters.js — Filtron monumentet sipas atributeve (komuna, rajon, lloj, periudhë, etj.)
 */

const monumentFilters = {
  komuna: "",
  rajon: "",
  lloji: "",
  periudha: null,
  kategoria: "",
};

const HERITAGE_TYPE_ALIASES = {
  arkeologjike: ["arkeologjike", "arkeologjik", "arkeologjike"],
  arkitekturore: ["arkitekturore", "arkitekturor", "arkitekturore"],
  luajtshme: ["luajtshme", "e luajtshme", "luajtshme"],
};

function normalizeFilterText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeritageType(value, layerType) {
  const raw = normalizeFilterText(value || layerType || "");
  for (const [canonical, aliases] of Object.entries(HERITAGE_TYPE_ALIASES)) {
    if (aliases.some((a) => normalizeFilterText(a) === raw)) {
      return canonical;
    }
  }
  return raw;
}

function getFeatureKomuna(feature) {
  const p = feature?.properties || {};
  if (typeof getKomunaFromProps === "function") {
    const label = getKomunaFromProps(p);
    if (label) return label;
  }
  const raw = p.komuna || p.KOMUNA || "";
  if (
    typeof isInvalidKomunaValue === "function" &&
    isInvalidKomunaValue(raw)
  ) {
    return "";
  }
  return raw;
}

function getFeatureRajon(feature, rajonMap) {
  const p = feature?.properties || {};
  if (typeof getRajonFromProps === "function") {
    return getRajonFromProps(p, rajonMap);
  }
  return p.rajon || p.Rajoni || p.rajoni || "";
}

function getFeatureLloji(feature, layerType) {
  const p = feature?.properties || {};
  return normalizeHeritageType(
    p.lloji_trashegimise || p.lloji || p.LLOJI || layerType || "",
    layerType
  );
}

function collectUniqueSorted(values) {
  const set = new Set();
  values.forEach((v) => {
    const s = String(v || "").trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "sq"));
}

function collectRajonFilterOptions(features, rajonMap) {
  const set = new Set();

  if (typeof getCanonicalRajons === "function") {
    getCanonicalRajons(rajonMap).forEach((r) => set.add(r));
  } else {
    Object.values(rajonMap || {}).forEach((r) => {
      if (r && normalizeFilterText(r) !== normalizeFilterText("Kosovë")) {
        set.add(r);
      }
    });
  }

  features.forEach((f) => {
    const r = getFeatureRajon(f, rajonMap);
    if (r && normalizeFilterText(r) !== normalizeFilterText("Kosovë")) {
      set.add(r);
    }
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b, "sq"));
}

function featureMatchesMonumentFilters(feature, layerType) {
  const p = feature?.properties || {};
  const f = monumentFilters;

  if (f.lloji && getFeatureLloji(feature, layerType) !== f.lloji) {
    return false;
  }

  if (f.komuna) {
    const komuna = getFeatureKomuna(feature);
    if (normalizeFilterText(komuna) !== normalizeFilterText(f.komuna)) {
      return false;
    }
  }

  if (f.rajon) {
    const rajon = getFeatureRajon(feature, window.tkkKomunaRajonMap || null);
    if (normalizeFilterText(rajon) !== normalizeFilterText(f.rajon)) {
      return false;
    }
  }

  if (f.periudha) {
    const key =
      typeof window.normalizePeriudha === "function"
        ? window.normalizePeriudha(p)
        : p.periudha || "";
    if (key !== f.periudha) return false;
  }

  if (f.kategoria) {
    const featureKat =
      typeof normalizeKategoriaKey === "function"
        ? normalizeKategoriaKey(p.kategoria)
        : normalizeFilterText(p.kategoria);
    const filterKat =
      typeof normalizeKategoriaKey === "function"
        ? normalizeKategoriaKey(f.kategoria)
        : normalizeFilterText(f.kategoria);
    if (featureKat !== filterKat) return false;
  }

  return true;
}

function hasActiveMonumentFilters() {
  return !!(
    monumentFilters.komuna ||
    monumentFilters.rajon ||
    monumentFilters.lloji ||
    monumentFilters.periudha ||
    monumentFilters.kategoria
  );
}

function getFilteredFeatures() {
  const all = window.allMonumentFeatures || [];
  if (!hasActiveMonumentFilters()) return all;

  const registry = window.monumentRegistry || [];
  const typeByFeature = new Map();
  registry.forEach(({ feature, layer }) => {
    if (feature) {
      typeByFeature.set(feature, layer?._tkkType || "");
    }
  });

  return all.filter((feature) =>
    featureMatchesMonumentFilters(
      feature,
      typeByFeature.get(feature) || ""
    )
  );
}

function getFeatureLatLng(feature) {
  if (!feature) return null;

  const p = feature.properties || {};
  const latP = parseFloat(p.lat);
  const lonP = parseFloat(p.lon);
  if (Number.isFinite(latP) && Number.isFinite(lonP)) {
    return L.latLng(latP, lonP);
  }

  const g = feature.geometry;
  if (g?.type === "Point" && g.coordinates?.length >= 2) {
    let lon = Number(g.coordinates[0]);
    let lat = Number(g.coordinates[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      const r = 6378137;
      lon = (lon / r) * (180 / Math.PI);
      lat = (Math.atan(Math.exp(lat / r)) * 2 - Math.PI / 2) * (180 / Math.PI);
    }
    return L.latLng(lat, lon);
  }

  return null;
}

function zoomToFilteredMonuments() {
  if (!hasActiveMonumentFilters()) return;

  const map = window.map;
  if (!map || typeof L === "undefined") return;

  const features = getFilteredFeatures();
  if (!features.length) return;

  const bounds = L.latLngBounds([]);
  features.forEach((feature) => {
    const ll = getFeatureLatLng(feature);
    if (ll) bounds.extend(ll);
  });

  if (!bounds.isValid()) return;

  const padOpts = { animate: true, padding: [48, 48], maxZoom: 15 };

  if (features.length === 1) {
    map.setView(bounds.getCenter(), Math.max(map.getZoom(), 14), {
      animate: true,
    });
    return;
  }

  map.fitBounds(bounds.pad(0.12), padOpts);
}

function applyMonumentFiltersToMap() {
  const registry = window.monumentRegistry || [];

  registry.forEach(({ layer, feature, cluster }) => {
    if (typeof setMarkerVisible === "function") {
      setMarkerVisible(layer, cluster, true);
    }
  });

  if (typeof refreshMonumentSymbology === "function") {
    refreshMonumentSymbology();
  } else if (typeof refreshAllClusters === "function") {
    refreshAllClusters();
  }
}

function fillFilterSelect(selectId, values, formatLabel) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const current = select.value;
  const first = select.querySelector("option");
  select.innerHTML = "";
  if (first) select.appendChild(first);

  values.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = formatLabel ? formatLabel(value) : value;
    select.appendChild(opt);
  });

  if (current && Array.from(select.options).some((o) => o.value === current)) {
    select.value = current;
  }
}

function buildMonumentFilterOptions() {
  const features = window.allMonumentFeatures || [];
  if (!features.length) return;

  const rajonMap = window.tkkKomunaRajonMap || {};
  const komunat = collectUniqueSorted(features.map(getFeatureKomuna));
  const rajonet = collectRajonFilterOptions(features, rajonMap);
  const kategoriaMap = new Map();
  features.forEach((f) => {
    const raw = String((f.properties || {}).kategoria || "").trim();
    if (!raw) return;
    const key =
      typeof normalizeKategoriaKey === "function"
        ? normalizeKategoriaKey(raw)
        : raw;
    if (!kategoriaMap.has(key)) kategoriaMap.set(key, raw);
  });
  const kategorite = Array.from(kategoriaMap.entries())
    .sort((a, b) =>
      (typeof getKategoriaLabel === "function"
        ? getKategoriaLabel(a[1])
        : a[1]
      ).localeCompare(
        typeof getKategoriaLabel === "function"
          ? getKategoriaLabel(b[1])
          : b[1],
        "sq"
      )
    )
    .map(([, raw]) => raw);

  fillFilterSelect("filterKomuna", komunat, (v) =>
    typeof formatKomunaLabel === "function" ? formatKomunaLabel(v) : v
  );
  fillFilterSelect("filterRajon", rajonet, (v) =>
    typeof formatRajonLabel === "function" ? formatRajonLabel(v) : v
  );
  fillFilterSelect("filterKategoria", kategorite, (v) =>
    typeof getKategoriaLabel === "function" ? getKategoriaLabel(v) : v
  );

  const periudhaSelect = document.getElementById("filterPeriudha");
  if (periudhaSelect && periudhaSelect.options.length <= 1) {
    const periods =
      typeof TIMELINE_PERIODS !== "undefined" ? TIMELINE_PERIODS : [];
    periods.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.key;
      opt.textContent =
        typeof getPeriodLabel === "function"
          ? getPeriodLabel(item.key)
          : item.label || item.key;
      periudhaSelect.appendChild(opt);
    });
  }
}

function syncFilterUiFromState() {
  const map = {
    filterKomuna: monumentFilters.komuna,
    filterRajon: monumentFilters.rajon,
    filterLloji: monumentFilters.lloji,
    filterPeriudha: monumentFilters.periudha || "",
    filterKategoria: monumentFilters.kategoria,
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  });
}

function readFiltersFromUi() {
  monumentFilters.komuna =
    document.getElementById("filterKomuna")?.value.trim() || "";
  monumentFilters.rajon =
    document.getElementById("filterRajon")?.value.trim() || "";
  monumentFilters.lloji =
    document.getElementById("filterLloji")?.value.trim() || "";
  const periudha = document.getElementById("filterPeriudha")?.value || "";
  monumentFilters.periudha = periudha || null;
  monumentFilters.kategoria =
    document.getElementById("filterKategoria")?.value.trim() || "";
}

function downloadFilterExportFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filterExportFilename(ext) {
  return (
    "monumente-filtruar-" + new Date().toISOString().slice(0, 10) + "." + ext
  );
}

function getFilterExportFeatures() {
  if (!hasActiveMonumentFilters()) return [];
  return getFilteredFeatures();
}

function downloadFilteredMonumentsCsv() {
  const features = getFilterExportFeatures();
  if (!features.length) {
    window.alert(t("filters.noDownload"));
    return;
  }

  const buildCsv =
    typeof window.buildStatisticsCsv === "function"
      ? window.buildStatisticsCsv
      : null;

  const finish = (rajonMap) => {
    let csv;
    if (buildCsv) {
      csv = "\uFEFF" + buildCsv(features, rajonMap || {});
    } else {
      const header = "ID,Emri,Komuna,Rajoni,Lloji";
      const rows = features.map((f) => {
        const p = f.properties || {};
        return [
          p.id || p.ID || "",
          p.emri || p.EMRI || "",
          getFeatureKomuna(f),
          getFeatureRajon(f, rajonMap),
          p.lloji_trashegimise || p.LLOJI_TRASHEGIMISE || "",
        ]
          .map((v) => {
            const s = String(v ?? "");
            return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(",");
      });
      csv = "\uFEFF" + header + "\r\n" + rows.join("\r\n");
    }
    downloadFilterExportFile(
      csv,
      filterExportFilename("csv"),
      "text/csv;charset=utf-8"
    );
  };

  if (typeof loadKomunaRajonMap === "function") {
    loadKomunaRajonMap().then(finish);
  } else {
    finish(window.tkkKomunaRajonMap || {});
  }
}

function downloadFilteredMonumentsGeoJson() {
  const features = getFilterExportFeatures();
  if (!features.length) {
    window.alert(t("filters.noDownload"));
    return;
  }

  const fc = {
    type: "FeatureCollection",
    features: features.map((feature) => {
      const ll = getFeatureLatLng(feature);
      const geometry = ll
        ? { type: "Point", coordinates: [ll.lng, ll.lat] }
        : feature.geometry || null;
      return {
        type: "Feature",
        geometry,
        properties: { ...(feature.properties || {}) },
      };
    }),
  };

  downloadFilterExportFile(
    JSON.stringify(fc, null, 2),
    filterExportFilename("geojson"),
    "application/geo+json"
  );
}

function updateFilterDownloadUi() {
  const wrap = document.getElementById("filtersDownloadWrap");
  if (wrap) wrap.hidden = !hasActiveMonumentFilters();
}

function updateActiveFilterSummary() {
  const box = document.getElementById("activePeriodChips");
  const clearBtn = document.getElementById("clearAllFiltersBtn");
  if (!box) return;

  updateFilterDownloadUi();

  if (!hasActiveMonumentFilters()) {
    box.innerHTML = '<span class="chip-muted">' + t("common.noFilter") + "</span>";
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  const n = getFilteredFeatures().length;
  const parts = [];

  if (monumentFilters.komuna) {
    parts.push(t("filters.chipKomuna") + ": " + monumentFilters.komuna);
  }
  if (monumentFilters.rajon) {
    parts.push(t("filters.chipRajon") + ": " + monumentFilters.rajon);
  }
  if (monumentFilters.lloji) {
    parts.push(
      t("filters.chipLloji") +
        ": " +
        (typeof getHeritageTypeLabel === "function"
          ? getHeritageTypeLabel(monumentFilters.lloji)
          : monumentFilters.lloji)
    );
  }
  if (monumentFilters.periudha) {
    parts.push(
      t("filters.chipPeriudha") +
        ": " +
        (typeof getPeriodLabel === "function"
          ? getPeriodLabel(monumentFilters.periudha)
          : monumentFilters.periudha)
    );
  }
  if (monumentFilters.kategoria) {
    parts.push(
      t("filters.chipKategoria") +
        ": " +
        (typeof getKategoriaLabel === "function"
          ? getKategoriaLabel(monumentFilters.kategoria)
          : monumentFilters.kategoria)
    );
  }

  box.innerHTML =
    '<span class="period-chip">' +
    parts.join(" · ") +
    "</span>" +
    '<span class="chip-count">' +
    tFormat("filter.monumentCount", { n }) +
    "</span>";

  if (clearBtn) {
    clearBtn.hidden = false;
    clearBtn.textContent = t("filters.clearAll");
  }
}

function applyMonumentFilters() {
  applyMonumentFiltersToMap();
  updateActiveFilterSummary();
  zoomToFilteredMonuments();

  if (typeof updatePeriudhaChart === "function") {
    updatePeriudhaChart(getFilteredFeatures());
  }
}

function clearAllMonumentFilters(skipTimelineSync) {
  monumentFilters.komuna = "";
  monumentFilters.rajon = "";
  monumentFilters.lloji = "";
  monumentFilters.periudha = null;
  monumentFilters.kategoria = "";

  syncFilterUiFromState();

  if (!skipTimelineSync && typeof window.syncTimelineUI === "function") {
    window.syncTimelineUI(null);
  }

  applyMonumentFilters();
}

function onMonumentFilterChange() {
  readFiltersFromUi();

  if (typeof window.syncTimelineUI === "function") {
    window.syncTimelineUI(monumentFilters.periudha);
  }

  applyMonumentFilters();
}

/** Vendos filtrin e periudhës (timeline ose dropdown) dhe sinkronizon UI. */
function setPeriodFilter(key, skipTimelineSync) {
  monumentFilters.periudha = key === "all" || !key ? null : key;
  syncFilterUiFromState();

  if (!skipTimelineSync && typeof window.syncTimelineUI === "function") {
    window.syncTimelineUI(monumentFilters.periudha);
  }

  applyMonumentFilters();
}

function getActivePeriodKey() {
  return monumentFilters.periudha;
}

function applyPeriodFilterToMap() {
  applyMonumentFiltersToMap();
}

let monumentFilterPanelBound = false;

function ensureRajonMapReady() {
  if (typeof loadKomunaRajonMap === "function") {
    return loadKomunaRajonMap().then((map) => {
      window.tkkKomunaRajonMap = map || {};
      return window.tkkKomunaRajonMap;
    });
  }
  window.tkkKomunaRajonMap = {};
  return Promise.resolve(window.tkkKomunaRajonMap);
}

function initMonumentFilterPanel() {
  ensureRajonMapReady().then(() => {
    buildMonumentFilterOptions();
    syncFilterUiFromState();
    updateActiveFilterSummary();
  });

  if (monumentFilterPanelBound) return;
  monumentFilterPanelBound = true;

  [
    "filterKomuna",
    "filterRajon",
    "filterLloji",
    "filterPeriudha",
    "filterKategoria",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", onMonumentFilterChange);
  });

  document.getElementById("clearAllFiltersBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAllMonumentFilters();
  });

  document
    .getElementById("filtersDownloadCsvBtn")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      downloadFilteredMonumentsCsv();
    });

  document
    .getElementById("filtersDownloadGeoJsonBtn")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      downloadFilteredMonumentsGeoJson();
    });
}

function initPeriodFilters() {
  initMonumentFilterPanel();
}

window.initPeriodFilters = initPeriodFilters;
window.initMonumentFilterPanel = initMonumentFilterPanel;
window.buildMonumentFilterOptions = buildMonumentFilterOptions;
window.setPeriodFilter = setPeriodFilter;
window.getFilteredFeatures = getFilteredFeatures;
window.getActivePeriodKey = getActivePeriodKey;
window.applyPeriodFilterToMap = applyPeriodFilterToMap;
window.applyMonumentFilters = applyMonumentFilters;
window.clearAllMonumentFilters = clearAllMonumentFilters;
window.updateActivePeriodChips = updateActiveFilterSummary;
window.hasActiveMonumentFilters = hasActiveMonumentFilters;
window.featureMatchesMonumentFilters = featureMatchesMonumentFilters;
window.zoomToFilteredMonuments = zoomToFilteredMonuments;
window.downloadFilteredMonumentsCsv = downloadFilteredMonumentsCsv;
window.downloadFilteredMonumentsGeoJson = downloadFilteredMonumentsGeoJson;
