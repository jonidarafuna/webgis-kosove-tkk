/**
 * Pamja e hartës — OSM, Google Satellite, kthe në parazgjedhje (sipas shkallës)
 */

function isViewPanelOpen() {
  const box = document.getElementById("mapToolResult");
  return box && !box.hidden && box.querySelector("[data-view-setup]");
}

function buildViewPanelHtml() {
  const mode =
    typeof getBasemapMode === "function" ? getBasemapMode() : "auto";

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

function refreshViewPanel() {
  if (!isViewPanelOpen()) return;
  if (typeof showMapToolResult === "function") {
    showMapToolResult(buildViewPanelHtml());
  }
}

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

function hideViewPanel() {
  if (typeof hideMapToolResult === "function") {
    hideMapToolResult();
  }
  const btn = document.querySelector('[data-tool-toggle="view"]');
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function handleBasemapModeClick(mode) {
  if (typeof setBasemapMode === "function") {
    setBasemapMode(mode);
  }
  if (mode === "auto" && typeof window.syncBasemapForZoom === "function") {
    window.syncBasemapForZoom();
  }
  refreshViewPanel();
}

function initMapView() {
  const btn = document.querySelector('[data-tool-toggle="view"]');
  if (!btn) return;

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

  document.getElementById("mapToolResult")?.addEventListener("click", (e) => {
    const modeBtn = e.target.closest("[data-basemap-mode]");
    if (!modeBtn || !isViewPanelOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    handleBasemapModeClick(modeBtn.dataset.basemapMode);
  });

  window.addEventListener("tkk:basemap-mode", () => {
    refreshViewPanel();
  });
}

document.addEventListener("DOMContentLoaded", initMapView);

window.isViewPanelOpen = isViewPanelOpen;
window.initMapView = initMapView;
window.refreshViewPanel = refreshViewPanel;
window.handleBasemapModeClick = handleBasemapModeClick;
