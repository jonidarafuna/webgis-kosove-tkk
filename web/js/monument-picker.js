/**
 * QËLLIMI: Kur disa monumente bien në të njëjtën pikë (ose cluster), shfaq listën
 *           për zgjedhje dhe drejton klikimin te paneli i detajeve.
 * KUR NGARKOHET: DOMContentLoaded; lidhet me hartën kur map.whenReady.
 * LIDHET ME: map.js (handleMonumentMapClick, bindClusterPicker), detail.js (showDetailPanel),
 *             index.html (#monumentPicker), i18n.js (picker.*).
 */

/** Vetëm pika në të njëjtën vendndodhje (mbivendosje reale), jo monumente të afërta */
const PICKER_SAME_SPOT_M = 3;
let pickerSuppressUntil = 0;

/** ID unik për një monument (lloji + id + koordinata) — shmang dublikatat. */
function monumentFeatureId(feature, typeKey) {
  const p = feature?.properties || {};
  const id = p.id ?? p.ID ?? p.gid ?? p.GID ?? "";
  const coords = feature?.geometry?.coordinates;
  const c =
    Array.isArray(coords) && coords.length >= 2
      ? coords[0].toFixed(6) + "," + coords[1].toFixed(6)
      : "";
  return String(typeKey || "") + "|" + id + "|" + c;
}

/** Nxjerr LatLng nga geometria GeoJSON e feature-it. */
function getMonumentLatLng(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  return L.latLng(coords[1], coords[0]);
}

/** A është markeri i dukshëm (jo i fshehur nga filtri ose shtresa)? */
function isMonumentMarkerVisible(entry) {
  if (!entry?.layer || entry.layer._tkkHidden) return false;
  const el = entry.layer.getElement?.();
  if (el && (el.style.display === "none" || el.style.pointerEvents === "none")) {
    return false;
  }
  return true;
}

/** Gjen të gjitha monumentet brenda radiusit maxM metra nga latlng. */
function getMonumentsAtPoint(latlng, maxM) {
  if (!latlng || !window.map) return [];
  const radius = typeof maxM === "number" ? maxM : PICKER_SAME_SPOT_M;
  const seen = new Set();
  const hits = [];

  (window.monumentRegistry || []).forEach((entry) => {
    if (!isMonumentMarkerVisible(entry)) return;
    const ll = getMonumentLatLng(entry.feature);
    if (!ll) return;
    if (window.map.distance(latlng, ll) > radius) return;

    const key = monumentFeatureId(entry.feature, entry.layer._tkkType);
    if (seen.has(key)) return;
    seen.add(key);

    hits.push({
      feature: entry.feature,
      layer: entry.layer,
      typeKey: entry.layer._tkkType || "",
      latlng: ll,
    });
  });

  hits.sort((a, b) => {
    const na = (a.feature.properties?.emri || a.feature.properties?.EMRI || "").toLowerCase();
    const nb = (b.feature.properties?.emri || b.feature.properties?.EMRI || "").toLowerCase();
    return na.localeCompare(nb, undefined, { sensitivity: "base" });
  });

  return hits;
}

/** Alias me distancë fikse PICKER_SAME_SPOT_M për mbivendosje. */
function getStackedMonumentsAt(latlng) {
  if (!latlng) return [];
  return getMonumentsAtPoint(latlng, PICKER_SAME_SPOT_M);
}

/** Konverton markerët e cluster-it në listë hits për picker. */
function markersToHits(markers) {
  return (markers || [])
    .filter((m) => m?.feature)
    .map((m) => ({
      feature: m.feature,
      layer: m,
      typeKey: m._tkkType || "",
      latlng: m.getLatLng(),
    }))
    .sort((a, b) => {
      const na = (a.feature.properties?.emri || a.feature.properties?.EMRI || "").toLowerCase();
      const nb = (b.feature.properties?.emri || b.feature.properties?.EMRI || "").toLowerCase();
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    });
}

/** Bashkon markerët e cluster-it me stacked në të njëjtën pikë. */
function getMonumentsFromMarkers(markers, latlng) {
  const fromMarkers = markersToHits(markers);
  if (fromMarkers.length <= 1) {
    return fromMarkers;
  }

  const ref = latlng || fromMarkers[0]?.latlng;
  if (!ref) return fromMarkers;

  const stacked = getStackedMonumentsAt(ref);
  const seen = new Set();
  const merged = [];

  fromMarkers.concat(stacked).forEach((hit) => {
    const key = monumentFeatureId(hit.feature, hit.typeKey);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(hit);
  });

  merged.sort((a, b) => {
    const na = (a.feature.properties?.emri || a.feature.properties?.EMRI || "").toLowerCase();
    const nb = (b.feature.properties?.emri || b.feature.properties?.EMRI || "").toLowerCase();
    return na.localeCompare(nb, undefined, { sensitivity: "base" });
  });

  return merged;
}

/** Etiketa e llojit për rreshtin në listën e picker-it. */
function getMonumentTypeLabel(typeKey) {
  const key = "picker.type." + typeKey;
  if (typeof t === "function" && t(key) !== key) return t(key);
  return typeKey;
}

/** Mbyll panelin dhe bllokon për pak kohë klikimet e hartës. */
function closeMonumentPicker() {
  pickerSuppressUntil = Date.now() + 500;
  const panel = document.getElementById("monumentPicker");
  if (panel) {
    panel.hidden = true;
    panel.classList.add("is-closed");
  }
  const list = document.getElementById("monumentPickerList");
  if (list) list.innerHTML = "";
}

/** Krahasohet nëse hit-i është i njëjti monument me atë aktiv. */
function isSameMonumentHit(hit, activeFeature, activeTypeKey) {
  if (!hit?.feature || !activeFeature) return false;
  return (
    monumentFeatureId(hit.feature, hit.typeKey) ===
    monumentFeatureId(activeFeature, activeTypeKey || hit.typeKey || "")
  );
}

/** Hap listën e monumenteve dhe ruan gjendjen për rifreskim gjuhë. */
function openMonumentPicker(hits, latlng, activeFeature, activeTypeKey) {
  const panel = document.getElementById("monumentPicker");
  const list = document.getElementById("monumentPickerList");
  const countEl = document.getElementById("monumentPickerCount");
  if (!panel || !list || !hits.length) return;

  list.innerHTML = "";
  hits.forEach((hit) => {
    const p = hit.feature.properties || {};
    const rawName = p.emri || p.EMRI || p.id || p.ID || "—";
    const name =
      typeof translateDataValue === "function"
        ? translateDataValue("emri", rawName, p)
        : rawName;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const active =
      activeFeature && isSameMonumentHit(hit, activeFeature, activeTypeKey);
    btn.className =
      "monument-picker-item monument-picker-item--" +
      (hit.typeKey || "other") +
      (active ? " is-active" : "");
    btn.innerHTML =
      '<span class="monument-picker-item__icon" aria-hidden="true"></span>' +
      '<span class="monument-picker-item__body">' +
      '<span class="monument-picker-item__name">' +
      escapePickerHtml(name) +
      "</span>" +
      '<span class="monument-picker-item__type">' +
      escapePickerHtml(getMonumentTypeLabel(hit.typeKey)) +
      "</span></span>";
    btn.addEventListener("click", () => {
      list.querySelectorAll(".monument-picker-item.is-active").forEach((el) => {
        el.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      if (typeof showDetailPanel === "function") {
        showDetailPanel(hit.feature);
      }
      if (window.map && hit.latlng) {
        window.map.panTo(hit.latlng, { animate: true });
      }
    });
    li.appendChild(btn);
    list.appendChild(li);
  });

  if (countEl) {
    countEl.textContent =
      typeof tFormat === "function"
        ? tFormat("picker.count", { n: hits.length })
        : hits.length + " site";
  }

  panel.hidden = false;
  panel.classList.remove("is-closed");

  window._tkkPickerState = {
    hits,
    latlng,
    activeFeature: activeFeature || null,
    activeTypeKey: activeTypeKey || "",
  };

  if (window.map && latlng) {
    const bounds = L.latLngBounds(hits.map((h) => h.latlng).filter(Boolean));
    if (bounds.isValid()) {
      window.map.panTo(bounds.getCenter(), { animate: true });
    }
  }
}

/** Escape HTML për emrat në listë (siguri). */
function escapePickerHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Klikim te një marker i vetëm — picker ose detaje direkt. */
function handleMonumentMarkerClick(latlng, feature, typeKey) {
  if (!latlng || !feature) return;
  if (Date.now() < pickerSuppressUntil) return;

  const stacked = getStackedMonumentsAt(latlng);
  if (stacked.length > 1) {
    openMonumentPicker(stacked, latlng, feature, typeKey);
    if (typeof showDetailPanel === "function") {
      showDetailPanel(feature);
    }
    if (window.map) {
      window.map.panTo(latlng, { animate: true });
    }
    return;
  }

  openMonumentDetail(feature, latlng);
}

/** Pika hyrëse nga map.js (cluster ose marker i vetëm). */
function handleMonumentMapClick(latlng, primaryFeature, clusterMarkers) {
  if (!latlng) return;
  if (Date.now() < pickerSuppressUntil) return;

  if (primaryFeature && (!clusterMarkers || clusterMarkers.length <= 1)) {
    handleMonumentMarkerClick(latlng, primaryFeature);
    return;
  }

  const hits = getMonumentsFromMarkers(clusterMarkers, latlng);
  if (hits.length > 1) {
    openMonumentPicker(hits, latlng);
    return;
  }
  if (hits.length === 1) {
    openMonumentDetail(hits[0].feature, hits[0].latlng);
  }
}

/** Mbyll picker-in dhe hap panelin e detajeve. */
function openMonumentDetail(feature, latlng) {
  if (!feature) return;
  closeMonumentPicker();
  if (typeof showDetailPanel === "function") {
    showDetailPanel(feature);
  }
  if (window.map && latlng) {
    window.map.panTo(latlng, { animate: true });
  }
}

/** Lidh clusterclick te një MarkerClusterGroup. */
function bindClusterPicker(clusterGroup) {
  if (!clusterGroup?.on || clusterGroup._tkkPickerBound) return;
  clusterGroup._tkkPickerBound = true;
  clusterGroup.on("clusterclick", (e) => {
    if (Date.now() < pickerSuppressUntil) return;
    if (e?.originalEvent) {
      L.DomEvent.stopPropagation(e.originalEvent);
    }
    const layer = e.layer;
    const markers = layer?.getAllChildMarkers?.() || [];
    const latlng = layer?.getLatLng?.();
    if (!latlng || !markers.length) return;

    if (markers.length > 1) {
      const hits = markersToHits(markers);
      if (hits.length > 1) {
        openMonumentPicker(hits, latlng);
        return;
      }
      if (hits.length === 1) {
        openMonumentDetail(hits[0].feature, hits[0].latlng);
        return;
      }
    }

    if (markers.length === 1 && markers[0].feature) {
      handleMonumentMarkerClick(
        markers[0].getLatLng(),
        markers[0].feature,
        markers[0]._tkkType
      );
    }
  });
}

/** Inicializon mbylljen, Escape dhe klikimin e hartës për të mbyllur picker-in. */
function initMonumentPicker() {
  const closeBtn = document.getElementById("monumentPickerClose");
  const panel = document.getElementById("monumentPicker");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMonumentPicker();
    });
  }
  if (panel) {
    panel.addEventListener("click", (e) => e.stopPropagation());
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMonumentPicker();
  });

  /** Lidh klikimin e hartës dhe cluster picker pas whenReady. */
  const bindMap = () => {
    if (!window.map || window._tkkPickerMapBound) return;
    window._tkkPickerMapBound = true;
    window.map.on("click", () => {
      if (Date.now() < pickerSuppressUntil) return;
      closeMonumentPicker();
    });
    (window.tkkClusterGroups || []).forEach(bindClusterPicker);
  };

  if (window.map?.whenReady) {
    window.map.whenReady(bindMap);
  } else {
    bindMap();
  }
}

/** Rindërton listën pas ndërrimit të gjuhës (tkk:lang-change). */
function refreshMonumentPickerI18n() {
  const panel = document.getElementById("monumentPicker");
  if (!panel || panel.hidden) return;
  const st = window._tkkPickerState;
  if (st?.hits?.length) {
    openMonumentPicker(
      st.hits,
      st.latlng,
      st.activeFeature,
      st.activeTypeKey
    );
    return;
  }
  const countEl = document.getElementById("monumentPickerCount");
  if (countEl && typeof tFormat === "function") {
    countEl.textContent = tFormat("picker.count", { n: 0 });
  }
}

document.addEventListener("DOMContentLoaded", initMonumentPicker);

window.getMonumentsAtPoint = getMonumentsAtPoint;
window.getStackedMonumentsAt = getStackedMonumentsAt;
window.handleMonumentMapClick = handleMonumentMapClick;
window.handleMonumentMarkerClick = handleMonumentMarkerClick;
window.openMonumentPicker = openMonumentPicker;
window.closeMonumentPicker = closeMonumentPicker;
window.openMonumentDetail = openMonumentDetail;
window.bindClusterPicker = bindClusterPicker;
window.refreshMonumentPickerI18n = refreshMonumentPickerI18n;

window.addEventListener("tkk:lang-change", refreshMonumentPickerI18n);
