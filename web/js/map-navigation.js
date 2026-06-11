/**
 * map-navigation.js — Navigim në WebGIS (GPS ose monument → monument) me OSRM.
 */

const OSRM_ROUTE_URL =
  "https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=false";
const NAV_START_KEY = "tkkNavRouteStart";
const NAV_HINT_POS_KEY = "tkkNavHintPos";
const NAV_HINT_SIZE_KEY = "tkkNavHintSize";
const NAV_HINT_MIN_WIDTH = 200;

let navigationLayer = null;
let navigationRouteLine = null;
let navigationStartMarker = null;
let navigationDestMarker = null;
let navigationActive = false;
let navigationLoading = false;
let navRouteStart = null;

function formatNavDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 1000) return (m / 1000).toFixed(1) + " km";
  return Math.round(m) + " m";
}

function formatNavDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "—";
  const mins = Math.round(s / 60);
  if (mins < 60) return mins + " min";
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h + " h " + r + " min";
}

function buildGoogleMapsDirectionsUrl(destLat, destLon, originLatLng) {
  if (!Number.isFinite(destLat) || !Number.isFinite(destLon)) return null;
  const dest = destLat + "," + destLon;
  let url =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(dest) +
    "&travelmode=driving";
  if (
    originLatLng &&
    Number.isFinite(originLatLng.lat) &&
    Number.isFinite(originLatLng.lon)
  ) {
    url +=
      "&origin=" +
      encodeURIComponent(originLatLng.lat + "," + originLatLng.lon);
  }
  return url;
}

function loadNavRouteStart() {
  try {
    const raw = sessionStorage.getItem(NAV_START_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(Number(parsed.lat)) &&
      Number.isFinite(Number(parsed.lon))
    ) {
      return {
        lat: Number(parsed.lat),
        lon: Number(parsed.lon),
        label: String(parsed.label || "").trim(),
        id: String(parsed.id || ""),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveNavRouteStart(point) {
  navRouteStart = point;
  if (point) {
    sessionStorage.setItem(NAV_START_KEY, JSON.stringify(point));
  } else {
    sessionStorage.removeItem(NAV_START_KEY);
  }
  window.dispatchEvent(new CustomEvent("tkk:nav-start-changed"));
}

function getNavRouteStart() {
  if (!navRouteStart) navRouteStart = loadNavRouteStart();
  return navRouteStart;
}

function isSameNavCoord(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(Number(a.lat) - Number(b.lat)) < 1e-5 &&
    Math.abs(Number(a.lon) - Number(b.lon)) < 1e-5
  );
}

function setNavRouteStartFromCoords(lat, lon, label, id) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  saveNavRouteStart({
    lat,
    lon,
    label: String(label || "").trim() || t("nav.startPoint"),
    id: String(id || ""),
  });
}

function clearNavRouteStart() {
  saveNavRouteStart(null);
}

function ensureNavigationLayer() {
  if (!window.map) return null;
  if (!navigationLayer) {
    navigationLayer = L.layerGroup().addTo(window.map);
  }
  return navigationLayer;
}

function getNavHintEl() {
  return document.getElementById("navRouteHint");
}

function getNavHintCanvas() {
  const hint = getNavHintEl();
  return hint?.closest(".map-canvas") || null;
}

function resetNavHintPosition() {
  const hint = getNavHintEl();
  if (!hint) return;
  hint.style.left = "50%";
  hint.style.top = "0.65rem";
  hint.style.right = "auto";
  hint.style.transform = "translateX(-50%)";
  hint.dataset.dragged = "";
}

function applySavedNavHintPosition() {
  const hint = getNavHintEl();
  if (!hint) return;
  try {
    const raw = sessionStorage.getItem(NAV_HINT_POS_KEY);
    if (!raw) {
      resetNavHintPosition();
      return;
    }
    const pos = JSON.parse(raw);
    if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) {
      resetNavHintPosition();
      return;
    }
    hint.style.left = pos.left + "px";
    hint.style.top = pos.top + "px";
    hint.style.transform = "none";
    hint.dataset.dragged = "1";
  } catch {
    resetNavHintPosition();
  }
}

function saveNavHintPosition(left, top) {
  sessionStorage.setItem(
    NAV_HINT_POS_KEY,
    JSON.stringify({ left: Math.round(left), top: Math.round(top) })
  );
}

function getNavHintMaxWidth() {
  const canvas = getNavHintCanvas();
  if (!canvas) return 520;
  return Math.max(NAV_HINT_MIN_WIDTH, canvas.clientWidth - 12);
}

function applySavedNavHintSize() {
  const hint = getNavHintEl();
  if (!hint) return;
  try {
    const raw = sessionStorage.getItem(NAV_HINT_SIZE_KEY);
    if (!raw) {
      hint.style.width = "";
      hint.classList.remove("is-sized");
      return;
    }
    const width = Number(JSON.parse(raw).width);
    if (!Number.isFinite(width) || width < NAV_HINT_MIN_WIDTH) {
      hint.style.width = "";
      hint.classList.remove("is-sized");
      return;
    }
    const w = Math.min(width, getNavHintMaxWidth());
    hint.style.width = w + "px";
    hint.classList.add("is-sized");
  } catch {
    hint.style.width = "";
    hint.classList.remove("is-sized");
  }
}

function saveNavHintSize(width) {
  sessionStorage.setItem(
    NAV_HINT_SIZE_KEY,
    JSON.stringify({ width: Math.round(width) })
  );
}

function clampNavHintWidth(width) {
  return Math.min(Math.max(NAV_HINT_MIN_WIDTH, width), getNavHintMaxWidth());
}

function clampNavHintPosition(left, top) {
  const hint = getNavHintEl();
  const canvas = getNavHintCanvas();
  if (!hint || !canvas) return { left, top };
  const c = canvas.getBoundingClientRect();
  const h = hint.getBoundingClientRect();
  const pad = 6;
  const maxLeft = Math.max(pad, c.width - h.width - pad);
  const maxTop = Math.max(pad, c.height - h.height - pad);
  return {
    left: Math.min(Math.max(pad, left), maxLeft),
    top: Math.min(Math.max(pad, top), maxTop),
  };
}

function initNavHintDrag() {
  const hint = getNavHintEl();
  if (!hint || hint._tkkDragInit) return;
  hint._tkkDragInit = true;

  let dragging = false;
  let resizing = false;
  let pointerId = null;
  let offsetX = 0;
  let offsetY = 0;
  let resizeStartX = 0;
  let resizeStartW = 0;

  function onPointerDown(e) {
    const resizeHandle = e.target.closest(".nav-route-hint__resize");
    if (resizeHandle && hint.contains(resizeHandle)) {
      resizing = true;
      pointerId = e.pointerId;
      resizeHandle.setPointerCapture?.(pointerId);
      resizeStartX = e.clientX;
      resizeStartW = hint.offsetWidth;
      hint.classList.add("is-resizing", "is-sized");
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const handle = e.target.closest(".nav-route-hint__drag");
    if (!handle || !hint.contains(handle)) return;
    const canvas = getNavHintCanvas();
    if (!canvas) return;

    dragging = true;
    pointerId = e.pointerId;
    handle.setPointerCapture?.(pointerId);

    const hintRect = hint.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    offsetX = e.clientX - hintRect.left;
    offsetY = e.clientY - hintRect.top;

    if (!hint.dataset.dragged) {
      hint.style.transform = "none";
      hint.style.left = hintRect.left - canvasRect.left + "px";
      hint.style.top = hintRect.top - canvasRect.top + "px";
      hint.dataset.dragged = "1";
    }

    hint.classList.add("is-dragging");
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return;

    if (resizing) {
      const nextW = clampNavHintWidth(resizeStartW + (e.clientX - resizeStartX));
      hint.style.width = nextW + "px";
      if (hint.dataset.dragged) {
        const left = parseFloat(hint.style.left);
        const top = parseFloat(hint.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) {
          const clamped = clampNavHintPosition(left, top);
          hint.style.left = clamped.left + "px";
          hint.style.top = clamped.top + "px";
        }
      }
      e.preventDefault();
      return;
    }

    if (!dragging) return;
    const canvas = getNavHintCanvas();
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const next = clampNavHintPosition(
      e.clientX - canvasRect.left - offsetX,
      e.clientY - canvasRect.top - offsetY
    );
    hint.style.left = next.left + "px";
    hint.style.top = next.top + "px";
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;

    if (resizing) {
      resizing = false;
      pointerId = null;
      hint.classList.remove("is-resizing");
      const width = hint.offsetWidth;
      if (width >= NAV_HINT_MIN_WIDTH) {
        saveNavHintSize(width);
      }
      return;
    }

    if (!dragging) return;
    dragging = false;
    pointerId = null;
    hint.classList.remove("is-dragging");
    const left = parseFloat(hint.style.left);
    const top = parseFloat(hint.style.top);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      saveNavHintPosition(left, top);
    }
  }

  hint.addEventListener("pointerdown", onPointerDown);
  hint.addEventListener("pointermove", onPointerMove);
  hint.addEventListener("pointerup", onPointerUp);
  hint.addEventListener("pointercancel", onPointerUp);
}

function hideNavRouteHint() {
  const hint = getNavHintEl();
  if (!hint) return;
  hint.hidden = true;
  hint.innerHTML = "";
  hint.classList.remove("is-dragging", "is-resizing");
}

function isNavSessionActive() {
  return navigationActive || navigationLoading;
}

function clearWebNavigation() {
  navigationActive = false;
  navigationLoading = false;
  if (navigationLayer) navigationLayer.clearLayers();
  navigationRouteLine = null;
  navigationStartMarker = null;
  navigationDestMarker = null;
  hideNavRouteHint();
  window.dispatchEvent(new CustomEvent("tkk:navigation-cleared"));
}

function escapeNavHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showNavigationHint(distanceM, durationS, fromLabel, toLabel) {
  const hint = getNavHintEl();
  if (!hint || !navigationActive) return;

  const dest = String(toLabel || "").trim() || t("nav.destination");
  const from = String(fromLabel || "").trim();
  const meta =
    formatNavDistance(distanceM) + " · ~" + formatNavDuration(durationS);

  const routeLine = from
    ? escapeNavHtml(from) + " → " + escapeNavHtml(dest)
    : "→ " + escapeNavHtml(dest);

  hint.innerHTML =
    '<button type="button" class="nav-route-hint__drag" aria-label="' +
    escapeNavHtml(t("nav.dragHint")) +
    '" title="' +
    escapeNavHtml(t("nav.dragHint")) +
    '">⠿</button>' +
    '<div class="nav-route-hint__body">' +
    '<span class="nav-route-hint__meta">' +
    escapeNavHtml(meta) +
    "</span>" +
    '<span class="nav-route-hint__dest">' +
    routeLine +
    "</span>" +
    "</div>" +
    '<button type="button" class="nav-route-hint__clear" id="navRouteClearBtn" aria-label="' +
    escapeNavHtml(t("nav.clearRoute")) +
    '">×</button>' +
    '<span class="nav-route-hint__resize" role="separator" aria-label="' +
    escapeNavHtml(t("nav.resizeHint")) +
    '" title="' +
    escapeNavHtml(t("nav.resizeHint")) +
    '"></span>';

  hint.hidden = false;
  applySavedNavHintSize();
  if (!hint.dataset.dragged) applySavedNavHintPosition();

  document.getElementById("navRouteClearBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearWebNavigation();
  });
}

function showNavigationLoading(fromLabel, toLabel) {
  const hint = getNavHintEl();
  if (!hint || !navigationLoading) return;
  const dest = String(toLabel || "").trim() || t("nav.destination");
  const from = String(fromLabel || "").trim();
  hint.innerHTML =
    '<span class="nav-route-hint__loading">' +
    escapeNavHtml(
      from
        ? tFormat("nav.loadingMonument", { start: from, dest })
        : tFormat("nav.loadingGps", { dest })
    ) +
    "</span>";
  hint.hidden = false;
  applySavedNavHintSize();
  if (!hint.dataset.dragged) applySavedNavHintPosition();
}

function getUserGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err || new Error("denied")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  });
}

function fetchOsrmRoute(from, to) {
  const coords = from.lon + "," + from.lat + ";" + to.lon + "," + to.lat;
  const url = OSRM_ROUTE_URL.replace("{coords}", coords);
  return fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || data.code !== "Ok" || !data.routes?.length) {
        throw new Error("no_route");
      }
      return data.routes[0];
    });
}

function drawNavigationRoute(route, from, to, fromLabel, toLabel) {
  const layer = ensureNavigationLayer();
  if (!layer || !route?.geometry) return;

  layer.clearLayers();

  navigationRouteLine = L.geoJSON(route.geometry, {
    style: {
      color: "#22d3ee",
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    },
  }).addTo(layer);

  navigationStartMarker = L.circleMarker([from.lat, from.lon], {
    radius: 7,
    color: "#0d9488",
    weight: 2,
    fillColor: "#5eead4",
    fillOpacity: 1,
  }).addTo(layer);

  navigationDestMarker = L.circleMarker([to.lat, to.lon], {
    radius: 7,
    color: "#0891b2",
    weight: 2,
    fillColor: "#67e8f9",
    fillOpacity: 1,
  }).addTo(layer);

  const bounds = navigationRouteLine.getBounds();
  if (bounds.isValid() && window.map) {
    window.map.fitBounds(bounds.pad(0.12), { animate: true, maxZoom: 16 });
  }

  navigationLoading = false;
  navigationActive = true;
  showNavigationHint(
    route.distance,
    route.duration,
    fromLabel || "",
    toLabel || t("nav.destination")
  );
  window.dispatchEvent(
    new CustomEvent("tkk:navigation-active", {
      detail: { from, to, distance: route.distance, duration: route.duration },
    })
  );
}

function navigationErrorMessage(err) {
  if (!err) return t("nav.errorGeneric");
  if (err.message === "unsupported") return t("nav.errorUnsupported");
  if (err.message === "no_route") return t("nav.errorNoRoute");
  if (err.message === "no_start") return t("nav.errorNoStart");
  if (err.message === "same_point") return t("nav.errorSamePoint");
  if (err.code === 1) return t("nav.errorDenied");
  if (err.code === 2) return t("nav.errorUnavailable");
  if (err.code === 3) return t("nav.errorTimeout");
  return t("nav.errorGeneric");
}

function prepareNavigationUi() {
  if (typeof deactivateMapTools === "function") deactivateMapTools();
  if (typeof hideViewPanel === "function") hideViewPanel();
}

function runWebRoute(from, to, fromLabel, toLabel) {
  if (!window.map) return Promise.resolve();
  if (isSameNavCoord(from, to)) {
    return Promise.reject(new Error("same_point"));
  }

  prepareNavigationUi();
  navigationLoading = true;
  showNavigationLoading(fromLabel, toLabel);

  return fetchOsrmRoute(from, to).then((route) => {
    if (!navigationLoading) return;
    drawNavigationRoute(route, from, to, fromLabel, toLabel);
  });
}

function startWebNavigation(destLat, destLon, destLabel) {
  const to = { lat: Number(destLat), lon: Number(destLon) };
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lon)) return;

  getUserGeolocation()
    .then((from) =>
      runWebRoute(from, to, t("nav.youAreHere"), destLabel)
    )
    .catch((err) => {
      clearWebNavigation();
      window.alert(navigationErrorMessage(err));
    });
}

function startWebNavigationFromMonument(destLat, destLon, destLabel) {
  const start = getNavRouteStart();
  if (!start) {
    window.alert(t("nav.errorNoStart"));
    return;
  }
  const to = { lat: Number(destLat), lon: Number(destLon) };
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lon)) return;

  runWebRoute(start, to, start.label, destLabel).catch((err) => {
    clearWebNavigation();
    window.alert(navigationErrorMessage(err));
  });
}

function refreshNavStartUi(currentLat, currentLon, currentLabel, currentId) {
  const start = getNavRouteStart();
  const hasCoords =
    Number.isFinite(currentLat) && Number.isFinite(currentLon);
  const sameAsCurrent =
    hasCoords && start && isSameNavCoord(start, { lat: currentLat, lon: currentLon });

  const setStartIds = ["detailMapsSetStartBtn", "detailMapsSetStartTab"];
  const fromStartIds = [
    "detailMapsNavigateFromStartBtn",
    "detailMapsNavigateFromStartTab",
  ];
  const gpsIds = ["detailMapsNavigateBtn", "detailMapsNavigateTab"];

  setStartIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (hasCoords) {
      btn.hidden = false;
      btn.style.display = "flex";
      btn.textContent = sameAsCurrent
        ? t("detail.mapsStartActive")
        : t("detail.mapsSetStart");
      btn.dataset.navLat = String(currentLat);
      btn.dataset.navLon = String(currentLon);
      btn.dataset.navLabel = currentLabel || "";
      btn.dataset.navId = currentId || "";
    } else {
      btn.hidden = true;
      btn.style.display = "none";
    }
  });

  const showFromStart = hasCoords && start && !sameAsCurrent;
  fromStartIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (showFromStart) {
      btn.hidden = false;
      btn.style.display = "flex";
      btn.textContent = tFormat("detail.mapsNavigateFromStart", {
        name: start.label || t("nav.startPoint"),
      });
      btn.dataset.navLat = String(currentLat);
      btn.dataset.navLon = String(currentLon);
      btn.dataset.navLabel = currentLabel || "";
    } else {
      btn.hidden = true;
      btn.style.display = "none";
    }
  });

  gpsIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (hasCoords) {
      btn.hidden = false;
      btn.style.display = "flex";
      btn.textContent = t("detail.mapsNavigate");
      btn.dataset.navLat = String(currentLat);
      btn.dataset.navLon = String(currentLon);
      btn.dataset.navLabel = currentLabel || "";
    } else {
      btn.hidden = true;
      btn.style.display = "none";
    }
  });

  const info = document.getElementById("detailNavStartInfo");
  if (info) {
    if (start) {
      info.hidden = false;
      info.textContent = tFormat("detail.mapsStartSaved", {
        name: start.label || t("nav.startPoint"),
      });
    } else {
      info.hidden = true;
      info.textContent = "";
    }
  }
}

function initMapNavigation() {
  navRouteStart = loadNavRouteStart();
  navigationActive = false;
  navigationLoading = false;
  hideNavRouteHint();
  initNavHintDrag();
  applySavedNavHintPosition();

  document.addEventListener("click", (e) => {
    const setStartBtn = e.target.closest("[data-nav-set-start]");
    if (setStartBtn && !setStartBtn.disabled) {
      e.preventDefault();
      const lat = parseFloat(setStartBtn.dataset.navLat);
      const lon = parseFloat(setStartBtn.dataset.navLon);
      const label = setStartBtn.dataset.navLabel || "";
      const id = setStartBtn.dataset.navId || "";
      setNavRouteStartFromCoords(lat, lon, label, id);
      if (window.lastDetailFeature) {
        const ll = resolveMonumentLatLngForNav(window.lastDetailFeature);
        const emri = String(
          (window.lastDetailFeature.properties || {}).emri || ""
        ).trim();
        const pid = String((window.lastDetailFeature.properties || {}).id || "");
        refreshNavStartUi(ll?.lat, ll?.lon, emri, pid);
      }
      return;
    }

    const fromStartBtn = e.target.closest("[data-navigate-from-start]");
    if (fromStartBtn && !fromStartBtn.disabled) {
      e.preventDefault();
      startWebNavigationFromMonument(
        parseFloat(fromStartBtn.dataset.navLat),
        parseFloat(fromStartBtn.dataset.navLon),
        fromStartBtn.dataset.navLabel || ""
      );
      return;
    }

    const gpsBtn = e.target.closest("[data-navigate-from-gps]");
    if (gpsBtn && !gpsBtn.disabled) {
      e.preventDefault();
      startWebNavigation(
        parseFloat(gpsBtn.dataset.navLat),
        parseFloat(gpsBtn.dataset.navLon),
        gpsBtn.dataset.navLabel || ""
      );
    }
  });

  window.addEventListener("tkk:nav-start-changed", () => {
    if (window.lastDetailFeature && typeof window.refreshMapsNavUi === "function") {
      window.refreshMapsNavUi(window.lastDetailFeature);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable)
    ) {
      return;
    }
    if (!isNavSessionActive()) return;
    e.preventDefault();
    clearWebNavigation();
  });
}

function resolveMonumentLatLngForNav(feature) {
  if (typeof resolveMonumentLatLng === "function") {
    return resolveMonumentLatLng(feature);
  }
  const p = feature?.properties || {};
  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon ?? p.lng);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
}

document.addEventListener("DOMContentLoaded", initMapNavigation);

window.startWebNavigation = startWebNavigation;
window.startWebNavigationFromMonument = startWebNavigationFromMonument;
window.clearWebNavigation = clearWebNavigation;
window.buildGoogleMapsDirectionsUrl = buildGoogleMapsDirectionsUrl;
window.refreshNavStartUi = refreshNavStartUi;
window.getNavRouteStart = getNavRouteStart;
window.clearNavRouteStart = clearNavRouteStart;
