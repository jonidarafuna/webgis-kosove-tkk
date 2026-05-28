/**
 * Filtri sipas periudhës — timeline + chips (mockup)
 */

let activePeriodKey = null;

function getFilteredFeatures() {
  const all = window.allMonumentFeatures || [];
  if (!activePeriodKey) return all;
  return all.filter(
    (f) => window.normalizePeriudha(f.properties || {}) === activePeriodKey
  );
}

function applyPeriodFilterToMap() {
  const registry = window.monumentRegistry || [];

  registry.forEach(({ layer, feature, cluster }) => {
    const key = window.normalizePeriudha(feature.properties || {});
    const show = !activePeriodKey || key === activePeriodKey;
    if (typeof setMarkerVisible === "function") {
      setMarkerVisible(layer, cluster, show);
    }
  });

  if (typeof refreshAllClusters === "function") {
    refreshAllClusters();
  }
}

function updateActivePeriodChips() {
  const box = document.getElementById("activePeriodChips");
  const clearBtn = document.getElementById("clearAllFiltersBtn");
  if (!box) return;

  if (!activePeriodKey) {
    box.innerHTML = '<span class="chip-muted">' + t("common.noFilter") + "</span>";
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  const label = getPeriodLabel(activePeriodKey);
  const n = getFilteredFeatures().length;
  box.innerHTML =
    '<span class="period-chip">' +
    label +
    ' <button type="button" class="chip-remove" data-clear-period title="' +
    t("filter.remove") +
    '" aria-label="' +
    t("filter.remove") +
    '">×</button></span>' +
    '<span class="chip-count">' +
    tFormat("filter.monumentCount", { n }) +
    "</span>";
  if (clearBtn) {
    clearBtn.hidden = false;
    clearBtn.textContent = t("filters.clearAll");
  }
}

function setPeriodFilter(key, skipTimelineSync) {
  activePeriodKey = key === "all" || !key ? null : key;

  if (!skipTimelineSync && typeof window.syncTimelineUI === "function") {
    window.syncTimelineUI(activePeriodKey);
  }

  applyPeriodFilterToMap();
  updateActivePeriodChips();

  if (typeof updatePeriudhaChart === "function") {
    updatePeriudhaChart(getFilteredFeatures());
  }
}

function initPeriodFilters() {
  const chips = document.getElementById("activePeriodChips");
  if (chips) {
    chips.addEventListener("click", (e) => {
      if (e.target.closest("[data-clear-period]")) setPeriodFilter("all");
    });
  }
  document.getElementById("clearAllFiltersBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    setPeriodFilter("all");
  });
  updateActivePeriodChips();
}

window.initPeriodFilters = initPeriodFilters;
window.setPeriodFilter = setPeriodFilter;
window.getFilteredFeatures = getFilteredFeatures;
window.applyPeriodFilterToMap = applyPeriodFilterToMap;
window.updateActivePeriodChips = updateActivePeriodChips;
