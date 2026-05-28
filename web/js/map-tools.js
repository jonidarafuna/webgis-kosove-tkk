/**
 * Mjetet e hartës — matje vijë/poligon, buffer me radius të zgjedhshëm
 */

let activeTool = null;
let measureMode = null;

const measureLayer = L.layerGroup();
const bufferLayer = L.layerGroup();

const measureState = {
  points: [],
  line: null,
  polygon: null,
  vertexMarkers: [],
  finished: false,
};

let bufferCircle = null;
let bufferCenterMarker = null;
let bufferHighlighted = [];
let bufferCenter = null;

function getMeasureDistanceUnitEl() {
  return (
    document.getElementById("measureDistanceUnitPanel") ||
    document.getElementById("measureDistanceUnit")
  );
}

function getMeasureAreaUnitEl() {
  return (
    document.getElementById("measureAreaUnitPanel") ||
    document.getElementById("measureAreaUnit")
  );
}

function getMeasureDistanceUnit() {
  const sel = getMeasureDistanceUnitEl();
  return sel?.value === "km" ? "km" : "m";
}

function getMeasureAreaUnit() {
  const sel = getMeasureAreaUnitEl();
  const v = sel?.value;
  if (v === "km2") return "km2";
  if (v === "ha") return "ha";
  return "m2";
}

function formatDistance(meters) {
  const unit = getMeasureDistanceUnit();
  if (unit === "km") {
    return (meters / 1000).toFixed(3) + " km";
  }
  return Math.round(meters) + " m";
}

function formatArea(sqMeters) {
  const unit = getMeasureAreaUnit();
  if (unit === "km2") {
    return (sqMeters / 1e6).toFixed(3) + " km²";
  }
  if (unit === "ha") {
    return (sqMeters / 10000).toFixed(2) + " ha";
  }
  return Math.round(sqMeters) + " m²";
}

function syncMeasureUnitSelects() {
  const distMenu = document.getElementById("measureDistanceUnit");
  const distPanel = document.getElementById("measureDistanceUnitPanel");
  const areaMenu = document.getElementById("measureAreaUnit");
  const areaPanel = document.getElementById("measureAreaUnitPanel");
  if (distMenu && distPanel) distPanel.value = distMenu.value;
  if (areaMenu && areaPanel) areaPanel.value = areaMenu.value;
}

function measureEditMeta() {
  return t("measure.editMeta");
}

function measureModeButtonsHtml() {
  return (
    '<div class="map-tool-mode-btns">' +
    '<button type="button" class="map-tool-action-btn" data-measure-mode="line">' +
    t("measure.lineBtn") +
    "</button>" +
    '<button type="button" class="map-tool-action-btn" data-measure-mode="polygon">' +
    t("measure.polygonBtn") +
    "</button>" +
    "</div>"
  );
}

function showMeasureSetupPanel() {
  setToggleButtonsActive(null);
  const btn = document.querySelector('[data-tool-toggle="measure"]');
  if (btn) btn.setAttribute("aria-expanded", "true");
  showToolResult(
    '<div data-measure-setup="1">' +
      "<span class='map-tool-result-label'>" +
      t("tools.measure") +
      "</span>" +
      "<p class='map-tool-result-value'>" +
      t("measure.chooseType") +
      "</p>" +
      measureUnitControlsHtml() +
      measureModeButtonsHtml() +
      "<p class='map-tool-result-meta'>" +
      t("measure.setupMeta") +
      "</p>" +
      "</div>"
  );
  syncMeasureUnitSelects();
}

function measureUnitControlsHtml() {
  const distU = getMeasureDistanceUnit();
  const areaU = getMeasureAreaUnit();
  return (
    '<div class="map-tool-panel-controls map-measure-units">' +
    '<label class="map-tool-menu-label">' +
    t("measure.distanceLabel") +
    "</label>" +
    '<select id="measureDistanceUnitPanel" class="map-tool-menu-select map-tool-menu-select--full" aria-label="' +
    t("measure.distanceAria") +
    '">' +
    '<option value="m"' +
    (distU === "m" ? " selected" : "") +
    ">" +
    t("measure.unitM") +
    "</option>" +
    '<option value="km"' +
    (distU === "km" ? " selected" : "") +
    ">" +
    t("measure.unitKm") +
    "</option>" +
    "</select>" +
    '<label class="map-tool-menu-label">' +
    t("measure.areaLabel") +
    "</label>" +
    '<select id="measureAreaUnitPanel" class="map-tool-menu-select map-tool-menu-select--full" aria-label="' +
    t("measure.areaAria") +
    '">' +
    '<option value="m2"' +
    (areaU === "m2" ? " selected" : "") +
    ">" +
    t("measure.unitM2") +
    "</option>" +
    '<option value="ha"' +
    (areaU === "ha" ? " selected" : "") +
    ">" +
    t("measure.unitHa") +
    "</option>" +
    '<option value="km2"' +
    (areaU === "km2" ? " selected" : "") +
    ">" +
    t("measure.unitKm2") +
    "</option>" +
    "</select>" +
    "</div>"
  );
}

function onMeasureUnitChange() {
  const distPanel = document.getElementById("measureDistanceUnitPanel");
  const distMenu = document.getElementById("measureDistanceUnit");
  const areaPanel = document.getElementById("measureAreaUnitPanel");
  const areaMenu = document.getElementById("measureAreaUnit");
  if (distPanel && distMenu) distMenu.value = distPanel.value;
  if (areaPanel && areaMenu) areaMenu.value = areaPanel.value;
  if (distMenu && distPanel) distPanel.value = distMenu.value;
  if (areaMenu && areaPanel) areaPanel.value = areaMenu.value;

  updateMeasureDisplay();
  if (measureState.finished) {
    refreshFinishedMeasurePanel();
  }
}

function lineLengthMeters(latlngs) {
  let total = 0;
  for (let i = 1; i < latlngs.length; i++) {
    total += map.distance(latlngs[i - 1], latlngs[i]);
  }
  return total;
}

/** Sipërfaqe gjeodezike (m²) — poligon i mbyllur */
function polygonAreaM2(latlngs) {
  if (latlngs.length < 3) return 0;
  const R = 6378137;
  const d2r = Math.PI / 180;
  let area = 0;
  const n = latlngs.length;
  for (let i = 0; i < n; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % n];
    area +=
      (p2.lng - p1.lng) *
      d2r *
      (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
  }
  return Math.abs((area * R * R) / 2);
}

function getBufferRadiusInputEl() {
  return (
    document.getElementById("bufferRadiusPanel") ||
    document.getElementById("bufferRadiusInput")
  );
}

function getBufferUnitSelectEl() {
  return (
    document.getElementById("bufferUnitPanel") ||
    document.getElementById("bufferUnitSelect")
  );
}

function getBufferUnit() {
  const sel = getBufferUnitSelectEl();
  return sel?.value === "m" ? "m" : "km";
}

function getBufferRadiusM() {
  const input = getBufferRadiusInputEl();
  const unit = getBufferUnit();
  const val = input ? parseFloat(input.value) : unit === "km" ? 5 : 5000;
  if (!Number.isFinite(val) || val <= 0) {
    return unit === "km" ? 5000 : 500;
  }
  return unit === "km" ? val * 1000 : val;
}

function formatBufferRadius() {
  const input = getBufferRadiusInputEl();
  const unit = getBufferUnit();
  const val = input ? parseFloat(input.value) : unit === "km" ? 5 : 5000;
  if (!Number.isFinite(val) || val <= 0) {
    return unit === "km" ? "5 km" : "500 m";
  }
  if (unit === "km") {
    return val + " km";
  }
  return Math.round(val) + " m";
}

function syncBufferInputValues() {
  const toolbar = document.getElementById("bufferRadiusInput");
  const panel = document.getElementById("bufferRadiusPanel");
  const toolbarU = document.getElementById("bufferUnitSelect");
  const panelU = document.getElementById("bufferUnitPanel");
  if (toolbar && panel) {
    panel.value = toolbar.value;
  }
  if (toolbarU && panelU) {
    panelU.value = toolbarU.value;
  }
}

function updateBufferInputLimits() {
  const inputs = [
    document.getElementById("bufferRadiusInput"),
    document.getElementById("bufferRadiusPanel"),
  ].filter(Boolean);
  if (!inputs.length) return;
  const unit = getBufferUnit();
  inputs.forEach((input) => {
    if (unit === "m") {
      input.min = "50";
      input.max = "100000";
      input.step = "50";
    } else {
      input.min = "0.1";
      input.max = "100";
      input.step = "0.5";
    }
  });
}

function onBufferUnitChange() {
  const input = getBufferRadiusInputEl();
  if (!input) return;
  const prevUnit = input.dataset.unit || "km";
  const unit = getBufferUnit();
  let val = parseFloat(input.value);
  if (!Number.isFinite(val)) val = prevUnit === "km" ? 5 : 5000;

  if (prevUnit === "km" && unit === "m") {
    val = Math.round(val * 1000);
  } else if (prevUnit === "m" && unit === "km") {
    val = Math.round((val / 1000) * 10) / 10;
  }

  const valStr = String(val);
  const toolbar = document.getElementById("bufferRadiusInput");
  const panel = document.getElementById("bufferRadiusPanel");
  if (toolbar) toolbar.value = valStr;
  if (panel) panel.value = valStr;

  input.dataset.unit = unit;
  if (toolbar) toolbar.dataset.unit = unit;
  if (panel) panel.dataset.unit = unit;

  updateBufferInputLimits();
  applyBufferRadiusChange();
}

function applyBufferRadiusChange() {
  syncBufferInputValues();
  if (bufferCenter) {
    refreshBuffer();
    return;
  }
  if (activeTool === "buffer") {
    showBufferPanel();
    setToolHint(
      tFormat("buffer.hintApply", { radius: formatBufferRadius() }),
      true
    );
  }
}

function keepBufferMenuOpen() {
  const btn = document.querySelector('[data-tool-toggle="buffer"]');
  if (btn) btn.setAttribute("aria-expanded", "true");
}

const BUFFER_EXPORT_COLUMNS = [
  "id",
  "emri",
  "lloji_trashegimise",
  "kategoria",
  "periudha",
  "komuna",
  "lat",
  "lon",
  "easting_kosovaref01",
  "northing_kosovaref01",
];

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadTextFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getBufferHitFeatures() {
  if (!bufferCenter) return [];
  return monumentsInBuffer(bufferCenter, getBufferRadiusM()).map((h) => h.feature);
}

function bufferExportFilename(ext) {
  const r = formatBufferRadius().replace(/\s/g, "");
  const d = new Date().toISOString().slice(0, 10);
  return "buffer_" + r + "_" + d + "." + ext;
}

function exportBufferCsv() {
  const features = getBufferHitFeatures();
  if (!features.length) return;
  const header = BUFFER_EXPORT_COLUMNS.join(",");
  const rows = features.map((f) => {
    const p = f.properties || {};
    return BUFFER_EXPORT_COLUMNS.map((col) =>
      escapeCsvCell(p[col] ?? "")
    ).join(",");
  });
  downloadTextFile(
    "\uFEFF" + header + "\n" + rows.join("\n"),
    bufferExportFilename("csv"),
    "text/csv;charset=utf-8"
  );
}

function exportBufferGeoJson() {
  const features = getBufferHitFeatures();
  if (!features.length) return;
  const fc = {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { ...(f.properties || {}) },
    })),
  };
  downloadTextFile(
    JSON.stringify(fc, null, 2),
    bufferExportFilename("geojson"),
    "application/geo+json"
  );
}

function bufferDownloadHtml(hitCount) {
  const count =
    hitCount !== undefined && hitCount !== null
      ? hitCount
      : bufferCenter
        ? monumentsInBuffer(bufferCenter, getBufferRadiusM()).length
        : 0;
  if (!bufferCenter || count < 1) return "";
  return (
    '<div class="map-buffer-download">' +
    '<button type="button" class="map-buffer-download-btn" id="bufferDownloadCsv">' +
    t("buffer.downloadCsv") +
    "</button>" +
    '<button type="button" class="map-buffer-download-btn" id="bufferDownloadGeoJson">' +
    t("buffer.downloadGeoJson") +
    "</button>" +
    "</div>"
  );
}

function bufferControlsHtml() {
  const input = getBufferRadiusInputEl();
  const val = input ? input.value : "5";
  const unit = getBufferUnit();
  return (
    '<div class="map-tool-panel-controls map-buffer-controls">' +
    '<label class="map-tool-menu-label" for="bufferRadiusPanel">' +
    t("buffer.changeRadius") +
    "</label>" +
    '<div class="map-tool-buffer-row">' +
    '<input type="number" id="bufferRadiusPanel" class="map-tool-menu-input" value="' +
    val +
    '" />' +
    '<select id="bufferUnitPanel" class="map-tool-menu-select" aria-label="' +
    t("buffer.unitAria") +
    '">' +
    '<option value="km"' +
    (unit === "km" ? " selected" : "") +
    ">km</option>" +
    '<option value="m"' +
    (unit === "m" ? " selected" : "") +
    ">m</option>" +
    "</select>" +
    "</div>" +
    '<button type="button" id="bufferApplyBtn" class="map-buffer-apply-btn">' +
    t("buffer.apply") +
    "</button>" +
    "</div>"
  );
}

function setToolHint() {
  /* Udhëzimet shfaqen vetëm në panelin e mjetit, jo te koordinatat. */
}

function showToolResult(html) {
  const box = document.getElementById("mapToolResult");
  if (!box) return;
  box.innerHTML = html;
  box.hidden = false;
  updateToolResultCompact(box);
}

function updateToolResultCompact(box) {
  if (!box) return;
  const compact =
    !!box.querySelector("[data-view-setup]") ||
    !!box.querySelector("[data-measure-setup]") ||
    !!box.querySelector("[data-buffer-panel]") ||
    !!box.querySelector(".map-measure-units") ||
    !!box.querySelector(".map-tool-mode-btns") ||
    (activeTool &&
      (activeTool.startsWith("measure") || activeTool === "buffer"));
  box.classList.toggle("map-tool-result--compact", compact);
}

function hideToolResult() {
  const box = document.getElementById("mapToolResult");
  if (!box) return;
  box.hidden = true;
  box.innerHTML = "";
  box.classList.remove("map-tool-result--compact");
}

function closeToolMenus() {
  document.querySelectorAll("[data-tool-toggle]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function isMeasureSetupOpen() {
  const box = document.getElementById("mapToolResult");
  return box && !box.hidden && box.querySelector("[data-measure-setup]");
}

function setToggleButtonsActive(tool) {
  document.querySelectorAll("[data-tool-toggle]").forEach((btn) => {
    const t = btn.dataset.toolToggle;
    const on =
      tool === t ||
      (tool === "measure-line" && t === "measure") ||
      (tool === "measure-polygon" && t === "measure") ||
      (tool === "view" && t === "view");
    btn.classList.toggle("map-tool-btn--active", on);
  });
}

window.setMapToolToggleActive = setToggleButtonsActive;
window.showMapToolResult = showToolResult;
window.hideMapToolResult = hideToolResult;
window.closeMapToolMenus = closeToolMenus;
window.updateToolResultCompact = updateToolResultCompact;

function clearMeasureGraphics() {
  measureState.points = [];
  measureState.finished = false;
  if (measureState.line) {
    measureLayer.removeLayer(measureState.line);
    measureState.line = null;
  }
  if (measureState.polygon) {
    measureLayer.removeLayer(measureState.polygon);
    measureState.polygon = null;
  }
  measureState.vertexMarkers.forEach((m) => measureLayer.removeLayer(m));
  measureState.vertexMarkers = [];
}

function getMeasureMinPoints() {
  return measureMode === "polygon" ? 3 : 2;
}

function createMeasureVertexMarker(latlng, index) {
  const vm = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({
      className: "measure-vertex-handle",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      html: '<span class="measure-vertex-dot"></span>',
    }),
    zIndexOffset: 1000,
  });

  vm._vertexIndex = index;

  vm.on("drag", function () {
    const i = this._vertexIndex;
    if (i < 0 || i >= measureState.points.length) return;
    measureState.points[i] = this.getLatLng();
    updateMeasureDisplay();
  });

  vm.on("dragend", function () {
    if (measureState.finished) {
      refreshFinishedMeasurePanel();
    }
  });

  vm.on("click", L.DomEvent.stopPropagation);
  vm.on("mousedown", L.DomEvent.stopPropagation);

  vm.on("contextmenu", function (ev) {
    L.DomEvent.stop(ev);
    L.DomEvent.preventDefault(ev);
    deleteMeasureVertex(this._vertexIndex);
  });

  return vm;
}

function refreshFinishedMeasurePanel() {
  if (!measureState.finished) return;
  const pts = measureState.points;
  const editMeta = measureEditMeta();

  if (measureMode === "line" && pts.length >= 2) {
    const total = lineLengthMeters(pts);
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.distanceTotal") +
        "</span>" +
        "<p class='map-tool-result-value'><strong>" +
        formatDistance(total) +
        "</strong></p>" +
        measureUnitControlsHtml() +
        "<p class='map-tool-result-meta'>" +
        editMeta +
        "</p>"
    );
    setToolHint(
      tFormat("measure.hintDistanceTotal", {
        value: formatDistance(total),
        meta: editMeta,
      }),
      true
    );
  } else if (measureMode === "polygon" && pts.length >= 3) {
    const area = polygonAreaM2(pts);
    const perimeter = lineLengthMeters(pts.concat([pts[0]]));
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.areaTotal") +
        "</span>" +
        "<p class='map-tool-result-value'><strong>" +
        formatArea(area) +
        "</strong></p>" +
        measureUnitControlsHtml() +
        "<p class='map-tool-result-meta'>" +
        t("measure.perimeter") +
        ": " +
        formatDistance(perimeter) +
        " · " +
        editMeta +
        "</p>"
    );
    setToolHint(
      tFormat("measure.hintAreaTotal", {
        value: formatArea(area),
        meta: editMeta,
      }),
      true
    );
  }
}

function rebuildVertexMarkers() {
  measureState.vertexMarkers.forEach((m) => measureLayer.removeLayer(m));
  measureState.vertexMarkers = [];
  measureState.points.forEach((latlng, i) => {
    const vm = createMeasureVertexMarker(latlng, i);
    measureLayer.addLayer(vm);
    measureState.vertexMarkers.push(vm);
  });
}

function deleteMeasureVertex(index) {
  const minPts = getMeasureMinPoints();
  if (
    index < 0 ||
    index >= measureState.points.length ||
    measureState.points.length <= minPts
  ) {
    deactivateMapTools();
    return;
  }

  measureState.points.splice(index, 1);
  rebuildVertexMarkers();
  updateMeasureDisplay();
  if (measureState.finished) {
    refreshFinishedMeasurePanel();
  }
}

function clearMeasure() {
  clearMeasureGraphics();
  measureMode = null;
}

function clearBuffer() {
  bufferHighlighted.forEach((m) => {
    const el = m.getElement?.();
    if (el) el.classList.remove("tkk-marker--in-buffer");
  });
  bufferHighlighted = [];
  if (bufferCircle) {
    bufferLayer.removeLayer(bufferCircle);
    bufferCircle = null;
  }
  if (bufferCenterMarker) {
    bufferLayer.removeLayer(bufferCenterMarker);
    bufferCenterMarker = null;
  }
}

function isMapToolPlacementActive() {
  return (
    activeTool === "measure-line" ||
    activeTool === "measure-polygon" ||
    activeTool === "buffer"
  );
}

function cancelBufferPlacement() {
  activeTool = null;
  setToggleButtonsActive(null);
  map.getContainer().style.cursor = "";
  map.off("click", onBufferClick);
  closeToolMenus();
  if (!bufferCenter) {
    hideToolResult();
    if (typeof window.resetMapCoordHint === "function") window.resetMapCoordHint();
  }
}

function cancelToolInteraction() {
  if (activeTool === "measure-line" || activeTool === "measure-polygon") {
    deactivateMapTools();
    return;
  }
  if (activeTool === "buffer") {
    if (!bufferCenter) {
      cancelBufferPlacement();
    } else {
      finishBuffer();
    }
  }
}

function deactivateMapTools() {
  activeTool = null;
  measureMode = null;
  bufferCenter = null;
  setToggleButtonsActive(null);
  map.getContainer().style.cursor = "";
  map.off("click", onMeasureClick);
  map.off("click", onBufferClick);
  clearMeasure();
  clearBuffer();
  closeToolMenus();
  hideToolResult();
  if (typeof window.resetMapCoordHint === "function") window.resetMapCoordHint();
}

function startMeasure(mode) {
  map.off("click", onBufferClick);
  if (activeTool === "buffer" && !bufferCenter) {
    activeTool = null;
    map.getContainer().style.cursor = "";
  }
  clearMeasure();
  closeToolMenus();

  measureMode = mode;
  activeTool = mode === "line" ? "measure-line" : "measure-polygon";
  setToggleButtonsActive(activeTool);
  map.getContainer().style.cursor = "crosshair";
  map.on("click", onMeasureClick);

  if (mode === "line") {
    setToolHint(t("measure.lineMapHint"), true);
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.lineTitle") +
        "</span>" +
        "<p class='map-tool-result-hint'>" +
        t("measure.lineHint") +
        "</p>"
    );
  } else {
    setToolHint(t("measure.polygonMapHint"), true);
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.polygonTitle") +
        "</span>" +
        "<p class='map-tool-result-hint'>" +
        t("measure.polygonHint") +
        "</p>"
    );
  }
}

function showBufferPanel(hitCount) {
  const label = formatBufferRadius();
  const count =
    hitCount !== undefined && hitCount !== null
      ? hitCount
      : bufferCenter
        ? monumentsInBuffer(bufferCenter, getBufferRadiusM()).length
        : null;

  let meta = bufferCenter ? t("buffer.activeMeta") : t("buffer.setupMeta");

  showToolResult(
    '<div data-buffer-panel="1">' +
      "<span class='map-tool-result-label'>Buffer " +
      label +
      "</span>" +
      (count !== null
        ? "<p class='map-tool-result-value'><strong>" +
          count +
          "</strong> " +
          t("common.monuments") +
          "</p>"
        : "<p class='map-tool-result-value'>" +
          tFormat("buffer.radiusStrong", { value: label }) +
          "</p>") +
      bufferControlsHtml() +
      bufferDownloadHtml(count) +
      "<p class='map-tool-result-meta'>" +
      meta +
      "</p>" +
      "</div>"
  );

  const panel = document.getElementById("bufferRadiusPanel");
  if (panel) {
    panel.dataset.unit = getBufferUnit();
    updateBufferInputLimits();
  }
  syncBufferInputValues();
}

function armBufferTool() {
  measureMode = null;
  map.off("click", onMeasureClick);
  clearMeasure();

  activeTool = "buffer";
  setToggleButtonsActive("buffer");
  map.getContainer().style.cursor = "crosshair";
  map.off("click", onBufferClick);
  map.on("click", onBufferClick);

  const label = formatBufferRadius();
  if (bufferCenter) {
    refreshBuffer();
    setToolHint(tFormat("buffer.clickNewCenter", { radius: label }), true);
  } else {
    setToolHint(tFormat("buffer.clickCenter", { radius: label }), true);
    showBufferPanel();
  }
}

function finishBuffer() {
  if (!bufferCenter) {
    cancelBufferPlacement();
    return;
  }

  activeTool = null;
  setToggleButtonsActive(null);
  map.getContainer().style.cursor = "";
  map.off("click", onBufferClick);

  if (bufferCenter) {
    const hits = monumentsInBuffer(bufferCenter, getBufferRadiusM()).length;
    const label = formatBufferRadius();
    setToolHint(
      tFormat("buffer.hintMonuments", {
        radius: label,
        n: hits,
      }),
      true
    );
    showBufferPanel(hits);
    keepBufferMenuOpen();
  }
}

function updateMeasureDisplay() {
  const pts = measureState.points;

  if (measureMode === "line") {
    if (pts.length < 2) {
      if (measureState.line) {
        measureLayer.removeLayer(measureState.line);
        measureState.line = null;
      }
      return;
    }

    if (measureState.line) {
      measureState.line.setLatLngs(pts);
    } else {
      measureState.line = L.polyline(pts, {
        color: "#2dd4bf",
        weight: 2.5,
        opacity: 0.95,
        dashArray: "6 4",
      });
      measureLayer.addLayer(measureState.line);
    }

    const total = lineLengthMeters(pts);
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.distance") +
        "</span>" +
        "<p class='map-tool-result-value'><strong>" +
        formatDistance(total) +
        "</strong></p>" +
        measureUnitControlsHtml() +
        "<p class='map-tool-result-meta'>" +
        tFormat("measure.pointsMeta", { n: pts.length }) +
        "</p>"
    );
    setToolHint(
      tFormat("measure.hintDistance", { value: formatDistance(total) }),
      true
    );
    return;
  }

  if (measureMode === "polygon") {
    if (measureState.line) {
      measureLayer.removeLayer(measureState.line);
      measureState.line = null;
    }

    if (pts.length >= 2) {
      measureState.line = L.polyline(pts, {
        color: "#2dd4bf",
        weight: 2,
        opacity: 0.7,
        dashArray: "4 4",
      });
      measureLayer.addLayer(measureState.line);
    }

    if (pts.length >= 3) {
      if (measureState.polygon) {
        measureState.polygon.setLatLngs(pts);
      } else {
        measureState.polygon = L.polygon(pts, {
          color: "#2dd4bf",
          weight: 2,
          fillColor: "#2dd4bf",
          fillOpacity: 0.15,
        });
        measureLayer.addLayer(measureState.polygon);
      }

      const perimeter = lineLengthMeters(pts.concat([pts[0]]));
      const area = polygonAreaM2(pts);
      showToolResult(
        "<span class='map-tool-result-label'>" +
          t("measure.polygon") +
          "</span>" +
          "<p class='map-tool-result-value'>" +
          t("measure.areaLabel") +
          ": <strong>" +
          formatArea(area) +
          "</strong></p>" +
          measureUnitControlsHtml() +
          "<p class='map-tool-result-meta'>" +
          tFormat("measure.perimeterPointsMeta", {
            perimeter: formatDistance(perimeter),
            n: pts.length,
          }) +
          "</p>"
      );
      setToolHint(
        tFormat("measure.hintArea", { value: formatArea(area) }),
        true
      );
    } else if (pts.length === 2) {
      showToolResult(
        "<span class='map-tool-result-label'>" +
          t("measure.polygon") +
          "</span>" +
          "<p class='map-tool-result-hint'>" +
          t("measure.polygonNeedPoint") +
          "</p>"
      );
    }
  }
}

function onMeasureClick(e) {
  if (measureState.finished) return;
  if (activeTool !== "measure-line" && activeTool !== "measure-polygon") return;
  L.DomEvent.stop(e);

  const latlng = e.latlng;
  measureState.points.push(latlng);

  const vm = createMeasureVertexMarker(latlng, measureState.points.length - 1);
  measureLayer.addLayer(vm);
  measureState.vertexMarkers.push(vm);

  updateMeasureDisplay();
}

function finishMeasure() {
  const pts = measureState.points;
  const isLine = measureMode === "line";
  const isPoly = measureMode === "polygon";

  if (
    (isLine && pts.length < 2) ||
    (isPoly && pts.length < 3) ||
    (!isLine && !isPoly)
  ) {
    deactivateMapTools();
    return;
  }

  const editMeta = measureEditMeta();

  if (isLine) {
    const total = lineLengthMeters(pts);
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.distanceTotal") +
        "</span>" +
        "<p class='map-tool-result-value'><strong>" +
        formatDistance(total) +
        "</strong></p>" +
        measureUnitControlsHtml() +
        "<p class='map-tool-result-meta'>" +
        editMeta +
        "</p>"
    );
    setToolHint(
      tFormat("measure.hintDistanceTotal", {
        value: formatDistance(total),
        meta: editMeta,
      }),
      true
    );
  } else {
    const area = polygonAreaM2(pts);
    const perimeter = lineLengthMeters(pts.concat([pts[0]]));
    showToolResult(
      "<span class='map-tool-result-label'>" +
        t("measure.areaTotal") +
        "</span>" +
        "<p class='map-tool-result-value'><strong>" +
        formatArea(area) +
        "</strong></p>" +
        measureUnitControlsHtml() +
        "<p class='map-tool-result-meta'>" +
        t("measure.perimeter") +
        ": " +
        formatDistance(perimeter) +
        " · " +
        editMeta +
        "</p>"
    );
    setToolHint(
      tFormat("measure.hintAreaTotal", {
        value: formatArea(area),
        meta: editMeta,
      }),
      true
    );
  }

  measureState.finished = true;
  activeTool = null;
  setToggleButtonsActive(null);
  map.getContainer().style.cursor = "";
  map.off("click", onMeasureClick);
}

function monumentsInBuffer(center, radiusM) {
  return (window.monumentRegistry || []).filter(({ feature }) => {
    const p = feature.properties || {};
    const lat = parseFloat(p.lat);
    const lon = parseFloat(p.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
    return map.distance(center, L.latLng(lat, lon)) <= radiusM;
  });
}

function refreshBuffer() {
  if (!bufferCenter) return;
  renderBuffer(bufferCenter);
}

function renderBuffer(center) {
  bufferCenter = center;
  const radiusM = getBufferRadiusM();
  const radiusLabel = formatBufferRadius();
  clearBuffer();

  bufferCircle = L.circle(center, {
    radius: radiusM,
    color: "#a78bfa",
    fillColor: "#a78bfa",
    fillOpacity: 0.12,
    weight: 2,
    opacity: 0.75,
  });
  bufferLayer.addLayer(bufferCircle);

  bufferCenterMarker = L.circleMarker(center, {
    radius: 5,
    color: "#a78bfa",
    fillColor: "#c4b5fd",
    fillOpacity: 1,
    weight: 2,
  });
  bufferLayer.addLayer(bufferCenterMarker);

  const hits = monumentsInBuffer(center, radiusM);
  bufferHighlighted = hits.map((h) => h.layer);
  bufferHighlighted.forEach((marker) => {
    const el = marker.getElement?.();
    if (el) el.classList.add("tkk-marker--in-buffer");
  });

  const names = hits
    .slice(0, 5)
    .map((h) => {
      const p = h.feature.properties || {};
      return typeof getMonumentDisplayName === "function"
        ? getMonumentDisplayName(p)
        : p.emri || "—";
    })
    .join(", ");
  const more =
    hits.length > 5
      ? tFormat("buffer.moreNames", { n: hits.length - 5 })
      : "";

  const popupHtml =
    "<strong>Buffer " +
    radiusLabel +
    "</strong><br>" +
    tFormat("buffer.monumentsInZone", { n: hits.length }) +
    (hits.length
      ? "<br><span style='font-size:0.85em'>" + names + more + "</span>"
      : "");

  bufferCircle.bindPopup(popupHtml);
  if (activeTool === "buffer") {
    bufferCircle.openPopup();
  }

  showBufferPanel(hits.length);
  keepBufferMenuOpen();
  setToolHint(
    tFormat("buffer.hintMonuments", {
      radius: radiusLabel,
      n: hits.length,
    }),
    true
  );
}

function onBufferClick(e) {
  if (activeTool !== "buffer") return;
  L.DomEvent.stop(e);
  renderBuffer(e.latlng);
}

function initMapTools() {
  measureLayer.addTo(map);
  bufferLayer.addTo(map);

  document
    .querySelector('[data-tool-toggle="measure"]')
    ?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (activeTool === "measure-line" || activeTool === "measure-polygon") {
        deactivateMapTools();
        return;
      }
      if (isMeasureSetupOpen()) {
        hideToolResult();
        closeToolMenus();
        return;
      }
      if (activeTool === "buffer") cancelToolInteraction();
      closeToolMenus();
      showMeasureSetupPanel();
    });

  document
    .querySelector('[data-tool-toggle="buffer"]')
    ?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const resultBox = document.getElementById("mapToolResult");
      const bufferPanelVisible =
        resultBox &&
        !resultBox.hidden &&
        !!resultBox.querySelector("[data-buffer-panel]");

      if (activeTool === "buffer") {
        cancelToolInteraction();
        return;
      }

      if (bufferPanelVisible && !activeTool) {
        hideToolResult();
        closeToolMenus();
        return;
      }

      closeToolMenus();
      setToggleButtonsActive(null);
      if (activeTool === "measure-line" || activeTool === "measure-polygon") {
        deactivateMapTools();
      }
      if (isMeasureSetupOpen()) hideToolResult();
      if (bufferCenter) {
        showBufferPanel();
        keepBufferMenuOpen();
        setToolHint(
          tFormat("buffer.panelHint", { radius: formatBufferRadius() }),
          true
        );
      } else {
        armBufferTool();
      }
    });

  document
    .getElementById("measureDistanceUnit")
    ?.addEventListener("change", onMeasureUnitChange);
  document.getElementById("measureAreaUnit")?.addEventListener("change", onMeasureUnitChange);

  const bufferInput = document.getElementById("bufferRadiusInput");
  if (bufferInput) {
    bufferInput.dataset.unit = getBufferUnit();
    updateBufferInputLimits();
  }

  bufferInput?.addEventListener("input", () => {
    syncBufferInputValues();
    applyBufferRadiusChange();
  });

  bufferInput?.addEventListener("change", () => {
    applyBufferRadiusChange();
  });

  document
    .getElementById("bufferUnitSelect")
    ?.addEventListener("change", onBufferUnitChange);

  const resultBox = document.getElementById("mapToolResult");
  resultBox?.addEventListener("input", (e) => {
    if (e.target.id !== "bufferRadiusPanel") return;
    const toolbar = document.getElementById("bufferRadiusInput");
    if (toolbar) toolbar.value = e.target.value;
    if (bufferCenter) refreshBuffer();
  });

  resultBox?.addEventListener("change", (e) => {
    if (e.target.id === "bufferUnitPanel") {
      const toolbarU = document.getElementById("bufferUnitSelect");
      if (toolbarU) toolbarU.value = e.target.value;
      onBufferUnitChange();
      return;
    }
    if (
      e.target.id === "measureDistanceUnitPanel" ||
      e.target.id === "measureAreaUnitPanel"
    ) {
      onMeasureUnitChange();
    }
  });

  resultBox?.addEventListener("click", (e) => {
    const basemapBtn = e.target.closest("[data-basemap-mode]");
    if (basemapBtn && resultBox.contains(basemapBtn)) {
      e.preventDefault();
      e.stopPropagation();
      const mode = basemapBtn.dataset.basemapMode;
      if (typeof setBasemapMode === "function") {
        setBasemapMode(mode);
      }
      if (typeof refreshViewPanel === "function") {
        refreshViewPanel();
      }
      return;
    }

    const modeBtn = e.target.closest("[data-measure-mode]");
    if (modeBtn) {
      e.preventDefault();
      startMeasure(modeBtn.dataset.measureMode);
      return;
    }
    if (e.target.id === "bufferApplyBtn") {
      e.preventDefault();
      const panel = document.getElementById("bufferRadiusPanel");
      const toolbar = document.getElementById("bufferRadiusInput");
      if (panel && toolbar) toolbar.value = panel.value;
      applyBufferRadiusChange();
      return;
    }
    if (e.target.id === "bufferDownloadCsv") {
      e.preventDefault();
      exportBufferCsv();
      return;
    }
    if (e.target.id === "bufferDownloadGeoJson") {
      e.preventDefault();
      exportBufferGeoJson();
    }
  });

  document.addEventListener("click", (ev) => {
    if (
      ev.target.closest(".map-tool-group") ||
      ev.target.closest(".map-tool-result") ||
      ev.target.closest("[data-measure-mode]") ||
      ev.target.closest(".map-tool-action-btn")
    ) {
      return;
    }

    closeToolMenus();

    if (isMeasureSetupOpen()) {
      hideToolResult();
      return;
    }

    if (typeof isViewPanelOpen === "function" && isViewPanelOpen()) {
      hideToolResult();
      if (typeof setMapToolToggleActive === "function") {
        setMapToolToggleActive(null);
      }
      return;
    }

    if (!isMapToolPlacementActive()) return;

    /* Klik në hartë = shto pikë / vendos buffer, jo anulim */
    if (
      ev.target.closest("#map") ||
      ev.target.closest(".leaflet-container") ||
      ev.target.closest(".leaflet-marker-icon") ||
      ev.target.closest(".measure-vertex-handle")
    ) {
      return;
    }

    cancelToolInteraction();
  });

  map.on("contextmenu", (e) => {
    if (e.originalEvent?.target?.closest?.(".measure-vertex-handle")) {
      return;
    }
    if (activeTool === "measure-line" || activeTool === "measure-polygon") {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      finishMeasure();
      return;
    }
    if (
      measureState.finished &&
      measureState.points.length >= getMeasureMinPoints()
    ) {
      return;
    }
    if (activeTool === "buffer") {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      cancelToolInteraction();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") deactivateMapTools();
  });
}

function refreshMapToolsI18n() {
  const resultBox = document.getElementById("mapToolResult");
  if (!resultBox || resultBox.hidden) return;

  if (resultBox.querySelector("[data-measure-setup]")) {
    showMeasureSetupPanel();
    return;
  }

  if (measureState.finished) {
    refreshFinishedMeasurePanel();
    return;
  }

  if (activeTool === "measure-line" || activeTool === "measure-polygon") {
    if (measureState.points.length) {
      updateMeasureDisplay();
    } else if (measureMode === "line") {
      showToolResult(
        "<span class='map-tool-result-label'>" +
          t("measure.lineTitle") +
          "</span>" +
          "<p class='map-tool-result-hint'>" +
          t("measure.lineHint") +
          "</p>"
      );
    } else if (measureMode === "polygon") {
      showToolResult(
        "<span class='map-tool-result-label'>" +
          t("measure.polygonTitle") +
          "</span>" +
          "<p class='map-tool-result-hint'>" +
          t("measure.polygonHint") +
          "</p>"
      );
    }
    return;
  }

  if (resultBox.querySelector("[data-buffer-panel]") || bufferCenter) {
    const hits = bufferCenter
      ? monumentsInBuffer(bufferCenter, getBufferRadiusM()).length
      : undefined;
    showBufferPanel(hits);
  }
}

window.initMapTools = initMapTools;
window.deactivateMapTools = deactivateMapTools;
window.refreshMapToolsI18n = refreshMapToolsI18n;
