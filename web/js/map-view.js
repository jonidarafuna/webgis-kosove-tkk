/**
 * SKEDARI: map-view.js
 * QËLLIMI: Paneli i pamjes së hartës — zgjedhja e bazës (OSM, satelit, auto sipas zoom-it).
 * KUR NGARKOHET: Pas map-basemaps.js, para map.js (index.html); initMapView në DOMContentLoaded.
 * LIDHET ME: map-basemaps.js (getBasemapMode, setBasemapMode, syncBasemapForZoom),
 *            map-tools.js (showMapToolResult, hideMapToolResult, deactivateMapTools), i18n.js (t).
 *
 * Pamja e hartës — OSM, Google Satellite, kthe në parazgjedhje (sipas shkallës)
 */

/** Kontrollon nëse paneli i pamjes është i hapur aktualisht. */
function isViewPanelOpen() {
  const box = document.getElementById("mapToolResult");
  return box && !box.hidden && box.querySelector("[data-view-setup]");
}

/** Ndërton HTML-in e panelit me opsionet OSM, satelit dhe auto. */
function buildViewPanelHtml() {
  const mode =
    typeof getBasemapMode === "function" ? getBasemapMode() : "auto";

  /** Krijon një buton opsioni me klasë is-active nëse është zgjedhur. */
  function optionBtn(value, label) {
    const active = mode === value ? " is-active" : "";
    return (
      '<button type="button" class="map-view-option' +
      active +
      '" data-basemap-mode="' +
      value +
      '">' +
      label +
      "</button>"
    );
  }

  return (
    '<div data-view-setup="1">' +
    "<span class='map-tool-result-label'>" + t("view.title") + "</span>" +
    "<p class='map-tool-result-value'>" + t("view.subtitle") + "</p>" +
    '<div class="map-view-options">' +
    optionBtn("osm", t("view.osm")) +
    optionBtn("satellite", t("view.satellite")) +
    "</div>" +
    '<button type="button" class="map-view-restore' +
    (mode === "auto" ? " is-active" : "") +
    '" data-basemap-mode="auto">' +
    t("view.restore") +
    "</button>" +
    "</div>"
  );
}

/** Rifreskon përmbajtjen e panelit nëse është i hapur. */
function refreshViewPanel() {
  if (!isViewPanelOpen()) return;
  if (typeof showMapToolResult === "function") {
    showMapToolResult(buildViewPanelHtml());
  }
}

/** Hap panelin e pamjes dhe shfaq opsionet e bazës. */
function showViewPanel() {
  const btn = document.querySelector('[data-tool-toggle="view"]');
  if (btn) btn.setAttribute("aria-expanded", "true");

  if (typeof showMapToolResult === "function") {
    showMapToolResult(buildViewPanelHtml());
  }

  if (typeof setMapToolToggleActive === "function") {
    setMapToolToggleActive("view");
  }
}

/** Mbyll panelin e pamjes dhe përditëson aria-expanded. */
function hideViewPanel() {
  if (typeof hideMapToolResult === "function") {
    hideMapToolResult();
  }
  const btn = document.querySelector('[data-tool-toggle="view"]');
  if (btn) btn.setAttribute("aria-expanded", "false");
}

/** Aplikon modalitetin e bazës (osm / satellite / auto) dhe rifreskon panelin. */
function handleBasemapModeClick(mode) {
  if (typeof setBasemapMode === "function") {
    setBasemapMode(mode);
  }
  if (mode === "auto" && typeof window.syncBasemapForZoom === "function") {
    window.syncBasemapForZoom();
  }
  refreshViewPanel();
}

/** Lidh butonin e pamjes dhe klikimet e opsioneve të bazës. */
function initMapView() {
  const btn = document.querySelector('[data-tool-toggle="view"]');
  if (!btn) return;

  // Toggle paneli pamje kur klikohet ikona e hartës
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (isViewPanelOpen()) {
      hideViewPanel();
      if (typeof setMapToolToggleActive === "function") {
        setMapToolToggleActive(null);
      }
      return;
    }

    if (typeof deactivateMapTools === "function") {
      deactivateMapTools();
    }
    if (typeof closeMapToolMenus === "function") {
      closeMapToolMenus();
    }

    showViewPanel();
  });

  // Klikimi i opsioneve OSM / satelit / auto brenda panelit
  document.getElementById("mapToolResult")?.addEventListener("click", (e) => {
    const modeBtn = e.target.closest("[data-basemap-mode]");
    if (!modeBtn || !isViewPanelOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    handleBasemapModeClick(modeBtn.dataset.basemapMode);
  });

  // Rifreskon panelin kur ndryshon bazë harta nga jashtë
  window.addEventListener("tkk:basemap-mode", () => {
    refreshViewPanel();
  });
}

document.addEventListener("DOMContentLoaded", initMapView);

window.isViewPanelOpen = isViewPanelOpen;
window.initMapView = initMapView;
window.refreshViewPanel = refreshViewPanel;
window.handleBasemapModeClick = handleBasemapModeClick;
