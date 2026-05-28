/**
 * Raportim problemesh me vendndodhje gjeografike
 */

const REPORT_CATEGORIES = [
  "damaged",
  "vandalism",
  "wrong_location",
  "wrong_info",
  "other",
];

const VGI_LOCAL_KEY = "tkkVgiReportsLocal";
function createVgiReportIcon(extraClass) {
  const cls = extraClass ? " " + extraClass : "";
  return L.divIcon({
    className: "tkk-vgi-marker-leaflet",
    html:
      '<div class="tkk-vgi-pin' +
      cls +
      '" aria-hidden="true">' +
      '<svg class="tkk-vgi-pin__svg" viewBox="0 0 28 40" width="20" height="28" focusable="false">' +
      '<path class="tkk-vgi-pin__shape" d="M14 0C6.82 0 1 5.82 1 13c0 9.8 13 27 13 27s13-17.2 13-27C27 5.82 21.18 0 14 0z"/>' +
      '<circle class="tkk-vgi-pin__dot" cx="14" cy="13" r="4"/>' +
      "</svg></div>",
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -26],
  });
}

function isVgiReportingEnabled() {
  const toggle = document.getElementById("appVgiReportsToggle");
  return toggle ? toggle.checked : false;
}

function setVgiReportingEnabled(enabled) {
  const toggle = document.getElementById("appVgiReportsToggle");
  if (toggle) toggle.checked = !!enabled;
  applyVgiReportingUi();
  window.dispatchEvent(
    new CustomEvent("tkk:vgi-enabled-change", { detail: { enabled: !!enabled } })
  );
}

function applyVgiReportingUi() {
  const on = isVgiReportingEnabled();
  const btn = document.getElementById("reportProblemBtn");
  if (btn) {
    btn.hidden = false;
    btn.disabled = false;
    btn.classList.toggle("report-problem-btn--off", !on);
    btn.title = on
      ? typeof t === "function"
        ? t("report.title")
        : "Raporto Problemin"
      : typeof t === "function"
        ? t("report.enableHint")
        : "Aktivizo Raportimet në header, ose kliko për të aktivizuar";
  }
  const toggle = document.getElementById("appVgiReportsToggle");
  if (toggle) toggle.checked = on;
  if (!on) {
    closeReportModal();
    stopPickMapMode();
    if (reportsLayer && window.map && window.map.hasLayer(reportsLayer)) {
      window.map.removeLayer(reportsLayer);
    }
    updateReportsCount(0);
  } else {
    loadCrowdReportsOnMap();
  }
}

function getLocalVgiReports() {
  try {
    const data = JSON.parse(localStorage.getItem(VGI_LOCAL_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLocalVgiReport(payload) {
  const report = {
    id: "VGI-local-" + Date.now(),
    createdAt: new Date().toISOString(),
    category: payload.category,
    categoryLabel: payload.categoryLabel,
    description: payload.description,
    email: payload.email,
    lat: payload.lat,
    lon: payload.lon,
    monumentId: payload.monumentId,
    monumentName: payload.monumentName,
  };
  const list = getLocalVgiReports();
  list.push(report);
  localStorage.setItem(VGI_LOCAL_KEY, JSON.stringify(list));
  return report;
}

function mergeVgiReportLists(serverList, localList) {
  const arr = Array.isArray(serverList) ? serverList : [];
  const local = Array.isArray(localList) ? localList : [];
  const ids = new Set(arr.map((r) => r.id).filter(Boolean));
  return arr.concat(local.filter((r) => r.id && !ids.has(r.id)));
}

async function probeVgiApi() {
  if (window.TKK_APP_MODE === "file") {
    window.TKK_VGI_API_OK = false;
    return false;
  }
  try {
    const r = await fetch(window.location.origin + "/api/health", { cache: "no-store" });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("application/json")) {
      window.TKK_VGI_API_OK = false;
      return false;
    }
    const data = await r.json();
    window.TKK_VGI_API_OK = !!(data && data.vgi);
    return window.TKK_VGI_API_OK;
  } catch {
    window.TKK_VGI_API_OK = false;
    return false;
  }
}

function normalizeReportMatchText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function reportMatchesMonument(report, props) {
  if (!report || !props) return false;

  const monumentId = props.id ?? props.ID ?? props.Id;
  const monumentName = props.emri ?? props.EMRI;

  if (report.monumentId && monumentId) {
    if (
      String(report.monumentId).trim().toLowerCase() ===
      String(monumentId).trim().toLowerCase()
    ) {
      return true;
    }
  }

  if (report.monumentName && monumentName) {
    const a = normalizeReportMatchText(report.monumentName);
    const b = normalizeReportMatchText(monumentName);
    if (a && b && (a === b || a.includes(b) || b.includes(a))) {
      return true;
    }
  }

  const mLat = parseFloat(props.lat ?? props.LAT);
  const mLon = parseFloat(props.lon ?? props.LON);
  const rLat = Number(report.lat);
  const rLon = Number(report.lon);
  if (
    Number.isFinite(mLat) &&
    Number.isFinite(mLon) &&
    Number.isFinite(rLat) &&
    Number.isFinite(rLon) &&
    window.map &&
    typeof window.map.distance === "function"
  ) {
    const dist = window.map.distance(L.latLng(mLat, mLon), L.latLng(rLat, rLon));
    if (dist <= 80) return true;
  }

  return false;
}

function getReportsForMonument(props) {
  return fetchAllVgiReports().then((list) => {
    const arr = Array.isArray(list) ? list : [];
    return arr
      .filter((r) => reportMatchesMonument(r, props))
      .sort((a, b) => {
        const ta = Date.parse(a.createdAt || "") || 0;
        const tb = Date.parse(b.createdAt || "") || 0;
        return tb - ta;
      });
  });
}

async function fetchAllVgiReports() {
  const local = getLocalVgiReports();
  if (window.TKK_APP_MODE === "file") return local;

  try {
    const r = await fetch(window.location.origin + "/api/vgi-reports", { cache: "no-store" });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("application/json")) {
      return local;
    }
    const server = await r.json();
    return mergeVgiReportLists(server, local);
  } catch {
    return local;
  }
}

function updateVgiServerHint() {
  const hint = document.getElementById("vgiReportServerHint");
  if (!hint) return;
  const show = window.TKK_APP_MODE !== "file" && window.TKK_VGI_API_OK === false;
  hint.hidden = !show;
  hint.textContent = show ? t("report.serverHint") : "";
}

let pickMapMode = false;
let pickMapHandler = null;
let pickMarker = null;
let reportsLayer = null;
let reportsVisible = true;
let selectedReportFeature = null;
const VGI_SEARCH_PREVIEW = 8;

function getReportCategoryLabel(key) {
  return t("report.cat." + key);
}

function getReportCoordSystem() {
  const sel = document.getElementById("vgiReportCoordSystem");
  return sel && sel.value === "wgs84" ? "wgs84" : "kref";
}

function formatCoords(latlng) {
  if (!latlng) return "";
  if (typeof window.formatLatLngWithSystem === "function") {
    return window.formatLatLngWithSystem(latlng, getReportCoordSystem());
  }
  const lat = Number(latlng.lat);
  const lon = Number(latlng.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return lat.toFixed(5) + ", " + lon.toFixed(5);
}

function refreshReportCoordsDisplay() {
  const el = document.getElementById("vgiReportCoords");
  if (!el) return;
  const lat = parseFloat(el.dataset.lat);
  const lon = parseFloat(el.dataset.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  el.value = formatCoords(L.latLng(lat, lon));
}

function setReportStatus(msg, isError) {
  const el = document.getElementById("vgiReportStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
  el.classList.toggle("is-success", !!msg && !isError);
}

function updateReportMonumentClearBtn() {
  const input = document.getElementById("vgiReportMonument");
  const clearBtn = document.getElementById("vgiReportMonumentClear");
  if (!clearBtn) return;
  clearBtn.hidden = !(input && input.value.trim().length > 0);
}

function closeVgiSearchDropdown() {
  const dropdown = document.getElementById("vgiReportSearchDropdown");
  const list = document.getElementById("vgiReportSearchResults");
  if (list) list.innerHTML = "";
  if (dropdown) dropdown.hidden = true;
}

function selectReportMonument(feature) {
  if (!feature) return;
  selectedReportFeature = feature;
  const input = document.getElementById("vgiReportMonument");
  const p = feature.properties || {};
  if (input) {
    input.value =
      typeof getMonumentDisplayName === "function"
        ? getMonumentDisplayName(p)
        : p.emri || p.EMRI || p.id || "";
  }
  updateReportMonumentClearBtn();
  closeVgiSearchDropdown();

  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon);
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    setReportCoords(L.latLng(lat, lon));
  }
}

function clearReportMonument() {
  selectedReportFeature = null;
  const input = document.getElementById("vgiReportMonument");
  if (input) input.value = "";
  updateReportMonumentClearBtn();
  closeVgiSearchDropdown();
}

function renderVgiSearchResults(query) {
  const listEl = document.getElementById("vgiReportSearchResults");
  const dropdown = document.getElementById("vgiReportSearchDropdown");
  if (!listEl || !dropdown) return;

  const label = (query || "").trim();
  const getMatches = window.tkkGetMonumentSearchMatches;
  const buildRow = window.tkkBuildSearchResultRowHtml;
  const matches =
    typeof getMatches === "function" && label.length >= 2
      ? getMatches(label)
      : [];

  listEl.innerHTML = "";

  if (label.length < 2) {
    dropdown.hidden = true;
    return;
  }

  if (!matches.length) {
    const li = document.createElement("li");
    li.className = "search-result-item search-result-item--empty";
    li.innerHTML =
      '<p class="search-empty-msg">' + t("search.empty") + "</p>";
    listEl.appendChild(li);
    dropdown.hidden = false;
    return;
  }

  matches.slice(0, VGI_SEARCH_PREVIEW).forEach((f) => {
    const li = document.createElement("li");
    li.className = "search-result-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result-btn";
    btn.innerHTML =
      typeof buildRow === "function" ? buildRow(f) : (f.properties || {}).emri || "";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectReportMonument(f);
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  });

  dropdown.hidden = false;
}

function fillMonumentFromSelection() {
  const f = window.lastDetailFeature;
  if (f && f.properties) {
    selectReportMonument(f);
    return;
  }
  clearReportMonument();
}

function setReportCoords(latlng) {
  const el = document.getElementById("vgiReportCoords");
  if (!el || !latlng) return;
  el.value = formatCoords(latlng);
  el.dataset.lat = String(latlng.lat);
  el.dataset.lon = String(latlng.lng);
  if (pickMarker) pickMarker.remove();
  if (window.map) {
    pickMarker = L.marker(latlng, {
      icon: createVgiReportIcon("tkk-vgi-pin--pick"),
      zIndexOffset: 600,
    }).addTo(window.map);
  }
}

function stopPickMapMode() {
  pickMapMode = false;
  document.body.classList.remove("vgi-pick-map-mode");
  const hint = document.getElementById("vgiPickMapHint");
  if (hint) hint.hidden = true;
  if (pickMapHandler && window.map) {
    window.map.off("click", pickMapHandler);
    pickMapHandler = null;
  }
}

function startPickMapMode() {
  if (!window.map) return;
  stopPickMapMode();
  pickMapMode = true;
  document.body.classList.add("vgi-pick-map-mode");
  const hint = document.getElementById("vgiPickMapHint");
  if (hint) hint.hidden = false;

  pickMapHandler = function (e) {
    setReportCoords(e.latlng);
    stopPickMapMode();
  };
  window.map.once("click", pickMapHandler);
}

function openReportModal() {
  const modal = document.getElementById("vgiReportModal");
  if (!modal) return;

  if (!isVgiReportingEnabled()) {
    setVgiReportingEnabled(true);
  }

  fillMonumentFromSelection();
  if (window.TKK_APP_MODE === "file") {
    setReportStatus(t("report.errorFile"), true);
  } else {
    setReportStatus("");
    probeVgiApi().then(() => updateVgiServerHint());
  }

  const coordSel = document.getElementById("vgiReportCoordSystem");
  const mapCoordSel = document.getElementById("coordSystemSelect");
  if (coordSel && mapCoordSel) {
    coordSel.value =
      mapCoordSel.value === "wgs84" || mapCoordSel.value === "kref"
        ? mapCoordSel.value
        : "kref";
  }

  const desc = document.getElementById("vgiReportDescription");
  if (desc) desc.value = "";

  const email = document.getElementById("vgiReportEmail");
  if (email) email.value = "";

  const cat = document.getElementById("vgiReportCategory");
  if (cat) cat.value = REPORT_CATEGORIES[0];

  let latlng = window.lastMapLatLng;
  if (window.lastDetailFeature) {
    const c = window.lastDetailFeature.geometry?.coordinates;
    if (c && c.length >= 2) {
      latlng = L.latLng(c[1], c[0]);
    }
  }
  if (latlng) setReportCoords(latlng);
  else {
    const coordsEl = document.getElementById("vgiReportCoords");
    if (coordsEl) {
      coordsEl.value = "";
      delete coordsEl.dataset.lat;
      delete coordsEl.dataset.lon;
    }
  }

  modal.hidden = false;
  document.getElementById("vgiReportDescription")?.focus();
}

function closeReportModal() {
  const modal = document.getElementById("vgiReportModal");
  if (modal) modal.hidden = true;
  closeVgiSearchDropdown();
  stopPickMapMode();
  if (pickMarker) {
    pickMarker.remove();
    pickMarker = null;
  }
}

function buildReportPayload() {
  const cat = document.getElementById("vgiReportCategory")?.value;
  const desc = (document.getElementById("vgiReportDescription")?.value || "").trim();
  const email = (document.getElementById("vgiReportEmail")?.value || "").trim();
  const coordsEl = document.getElementById("vgiReportCoords");
  const lat = parseFloat(coordsEl?.dataset.lat);
  const lon = parseFloat(coordsEl?.dataset.lon);
  const p = selectedReportFeature?.properties || {};
  const monumentName =
    (p.emri || p.EMRI || document.getElementById("vgiReportMonument")?.value || "")
      .trim() || null;
  const monumentId = p.id || p.ID || null;

  if (!cat || !desc || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    category: cat,
    categoryLabel: getReportCategoryLabel(cat),
    description: desc,
    email: email || null,
    lat,
    lon,
    monumentId,
    monumentName,
  };
}

async function submitReport() {
  if (!isVgiReportingEnabled()) {
    setReportStatus(t("report.disabled"), true);
    return;
  }

  const payload = buildReportPayload();
  if (!payload) {
    setReportStatus(t("report.errorValidation"), true);
    return;
  }

  setReportStatus("");

  if (window.TKK_APP_MODE === "file") {
    saveLocalVgiReport(payload);
    setReportStatus(t("report.successLocal"), false);
    loadCrowdReportsOnMap();
    if (typeof window.refreshDetailMonumentReports === "function") {
      window.refreshDetailMonumentReports();
    }
    setTimeout(closeReportModal, 2200);
    return;
  }

  let savedOnServer = false;
  try {
    const r = await fetch(window.location.origin + "/api/vgi-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const ct = r.headers.get("content-type") || "";
    if (r.ok && ct.includes("application/json")) {
      await r.json();
      savedOnServer = true;
      window.TKK_VGI_API_OK = true;
      updateVgiServerHint();
    }
  } catch {
    /* provo ruajtje lokale */
  }

  if (savedOnServer) {
    setReportStatus(t("report.success"), false);
    loadCrowdReportsOnMap();
    if (typeof window.refreshDetailMonumentReports === "function") {
      window.refreshDetailMonumentReports();
    }
    setTimeout(closeReportModal, 1800);
    return;
  }

  saveLocalVgiReport(payload);
  setReportStatus(t("report.successLocal"), false);
  window.TKK_VGI_API_OK = false;
  updateVgiServerHint();
  loadCrowdReportsOnMap();
  if (typeof window.refreshDetailMonumentReports === "function") {
    window.refreshDetailMonumentReports();
  }
  setTimeout(closeReportModal, 3200);
}

function createReportMarker(report) {
  const lat = Number(report.lat);
  const lon = Number(report.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const marker = L.marker([lat, lon], {
    icon: createVgiReportIcon(),
    zIndexOffset: 500,
  });

  const title = report.monumentName || report.monumentId || t("report.modalTitle");
  const latlng = L.latLng(lat, lon);
  let coordLine = "";
  if (typeof window.formatLatLngWithSystem === "function") {
    coordLine =
      "<br><small>" +
      escapeHtml(window.formatLatLngWithSystem(latlng, "wgs84")) +
      "<br>" +
      escapeHtml(window.formatLatLngWithSystem(latlng, "kref")) +
      "</small>";
  }

  const popup =
    "<strong>" +
    escapeHtml(title) +
    "</strong><br>" +
    escapeHtml(report.categoryLabel || report.category) +
    coordLine +
    "<br><em>" +
    escapeHtml((report.description || "").slice(0, 120)) +
    (report.description && report.description.length > 120 ? "…" : "") +
    "</em>";

  marker.bindPopup(popup);
  marker._vgiReport = true;
  return marker;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadCrowdReportsOnMap() {
  if (!window.map) return;

  if (!isVgiReportingEnabled()) {
    if (reportsLayer && window.map.hasLayer(reportsLayer)) {
      window.map.removeLayer(reportsLayer);
    }
    updateReportsCount(0);
    return;
  }

  if (!reportsLayer) {
    reportsLayer = L.layerGroup();
    reportsLayer.addTo(window.map);
  }
  reportsLayer.clearLayers();

  fetchAllVgiReports().then((list) => {
    const arr = Array.isArray(list) ? list : [];
    arr.forEach((rep) => {
      const m = createReportMarker(rep);
      if (m) reportsLayer.addLayer(m);
    });
    updateReportsCount(arr.length);
    if (reportsVisible && !window.map.hasLayer(reportsLayer)) {
      reportsLayer.addTo(window.map);
    }
    if (!reportsVisible && window.map.hasLayer(reportsLayer)) {
      window.map.removeLayer(reportsLayer);
    }
  });
}

function updateReportsCount(n) {
  const el = document.getElementById("vgiReportsCount");
  if (el) el.textContent = tFormat("report.reportsCount", { n: n || 0 });
}

function populateCategorySelect() {
  const cat = document.getElementById("vgiReportCategory");
  if (!cat) return;
  cat.innerHTML = REPORT_CATEGORIES.map(
    (k) => '<option value="' + k + '">' + getReportCategoryLabel(k) + "</option>"
  ).join("");
}

function initReportMonumentSearch() {
  const input = document.getElementById("vgiReportMonument");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) {
      selectedReportFeature = null;
      updateReportMonumentClearBtn();
      closeVgiSearchDropdown();
      return;
    }
    if (selectedReportFeature) {
      const p = selectedReportFeature.properties || {};
      const name =
        typeof getMonumentDisplayName === "function"
          ? getMonumentDisplayName(p)
          : p.emri || "";
      if (q !== name) selectedReportFeature = null;
    }
    renderVgiSearchResults(q);
    updateReportMonumentClearBtn();
  });

  input.addEventListener("focus", () => {
    updateReportMonumentClearBtn();
    if (input.value.trim().length >= 2) {
      renderVgiSearchResults(input.value);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const label = input.value.trim();
    if (label.length < 2) return;
    const find = window.tkkFindMonumentByQuery;
    if (typeof find === "function") {
      const feature = find(label);
      if (feature) selectReportMonument(feature);
    }
  });

  document.getElementById("vgiReportMonumentClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearReportMonument();
    input.focus();
  });

  document.addEventListener("click", (e) => {
    const combo = document.getElementById("vgiSearchCombo");
    if (!combo || combo.contains(e.target)) return;
    closeVgiSearchDropdown();
  });
}

function initReportVgi() {
  populateCategorySelect();
  initReportMonumentSearch();

  const vgiToggle = document.getElementById("appVgiReportsToggle");
  if (vgiToggle) {
    vgiToggle.checked = false;
    vgiToggle.addEventListener("change", () => {
      setVgiReportingEnabled(vgiToggle.checked);
    });
  }
  applyVgiReportingUi();

  const btn = document.getElementById("reportProblemBtn");
  if (btn) btn.addEventListener("click", openReportModal);

  document.getElementById("vgiReportClose")?.addEventListener("click", closeReportModal);
  document.getElementById("vgiReportCancel")?.addEventListener("click", closeReportModal);
  document.querySelectorAll("[data-vgi-close]").forEach((el) => {
    el.addEventListener("click", closeReportModal);
  });

  document.getElementById("vgiReportSubmit")?.addEventListener("click", submitReport);

  document.getElementById("vgiReportPickMap")?.addEventListener("click", startPickMapMode);

  const coordSel = document.getElementById("vgiReportCoordSystem");
  const mapCoordSel = document.getElementById("coordSystemSelect");
  if (coordSel && mapCoordSel) {
    coordSel.value =
      mapCoordSel.value === "wgs84" || mapCoordSel.value === "kref"
        ? mapCoordSel.value
        : "kref";
  }
  coordSel?.addEventListener("change", refreshReportCoordsDisplay);

  document.getElementById("vgiShowReports")?.addEventListener("change", (e) => {
    reportsVisible = e.target.checked;
    if (!reportsLayer) return;
    if (reportsVisible) reportsLayer.addTo(window.map);
    else window.map.removeLayer(reportsLayer);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pickMapMode) stopPickMapMode();
      else closeReportModal();
    }
  });

  probeVgiApi().then(() => updateVgiServerHint());

  if (window.map && typeof window.map.whenReady === "function") {
    window.map.whenReady(() => loadCrowdReportsOnMap());
  } else {
    setTimeout(loadCrowdReportsOnMap, 800);
  }
}

function refreshReportModalI18n() {
  const cat = document.getElementById("vgiReportCategory");
  const prev = cat ? cat.value : REPORT_CATEGORIES[0];
  populateCategorySelect();
  if (cat && REPORT_CATEGORIES.includes(prev)) cat.value = prev;
  fillMonumentFromSelection();
  refreshReportCoordsDisplay();
}

document.addEventListener("DOMContentLoaded", initReportVgi);
window.addEventListener("tkk:lang-change", refreshReportModalI18n);

window.openReportModal = openReportModal;
window.refreshReportModalI18n = refreshReportModalI18n;
window.loadCrowdReportsOnMap = loadCrowdReportsOnMap;
window.fetchAllVgiReports = fetchAllVgiReports;
window.getReportsForMonument = getReportsForMonument;
window.reportMatchesMonument = reportMatchesMonument;
window.isVgiReportingEnabled = isVgiReportingEnabled;
window.setVgiReportingEnabled = setVgiReportingEnabled;
window.applyVgiReportingUi = applyVgiReportingUi;
