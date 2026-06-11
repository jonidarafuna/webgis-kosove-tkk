/**
 * QËLLIMI: Paneli i detajeve të monumentit — fushat, foto, lidhje DTK dhe raportet VGI.
 * KUR NGARKOHET: DOMContentLoaded (tabs, mbyllja); showDetailPanel kur klikohet monumenti.
 * LIDHET ME: monument-picker.js, map.js (lastDetailFeature), report-vgi.js (getReportsForMonument),
 *             data/photos.json, /api/dtk-photos, i18n.js (detail.*).
 */

let photoIndex = {};
let lastDetailFeature = null;
let selectedMonumentMarker = null;
const SELECTED_MONUMENT_Z = 1200;
const DEFAULT_MONUMENT_Z = 800;

function monumentFeatureId(feature) {
  return String((feature?.properties || {}).id || "").trim();
}

function findMonumentMarkerForFeature(feature) {
  const id = monumentFeatureId(feature);
  if (!id) return null;
  const registry = window.monumentRegistry || [];
  for (const entry of registry) {
    if (monumentFeatureId(entry.feature) === id) {
      return entry.layer || null;
    }
  }
  return null;
}

function applySelectedMarkerClass(marker) {
  if (!marker?.getElement) return;
  const el = marker.getElement();
  if (el) el.classList.add("tkk-img-marker--selected");
}

function clearSelectedMonumentMarker() {
  if (!selectedMonumentMarker) return;
  const el = selectedMonumentMarker.getElement?.();
  if (el) el.classList.remove("tkk-img-marker--selected");
  if (typeof selectedMonumentMarker.setZIndexOffset === "function") {
    selectedMonumentMarker.setZIndexOffset(DEFAULT_MONUMENT_Z);
  }
  selectedMonumentMarker = null;
}

function setSelectedMonumentMarker(feature) {
  clearSelectedMonumentMarker();
  if (!feature) return;

  const marker = findMonumentMarkerForFeature(feature);
  if (!marker) return;

  selectedMonumentMarker = marker;
  if (typeof marker.setZIndexOffset === "function") {
    marker.setZIndexOffset(SELECTED_MONUMENT_Z);
  }

  applySelectedMarkerClass(marker);
  marker.once?.("add", () => applySelectedMarkerClass(marker));
}

function refreshSelectedMonumentMarker() {
  if (!lastDetailFeature) {
    clearSelectedMonumentMarker();
    return;
  }
  setSelectedMonumentMarker(lastDetailFeature);
}

function ensureSelectedMonumentMapHooks() {
  if (!window.map || window.map._tkkSelectedHook) return;
  window.map._tkkSelectedHook = true;
  window.map.on("moveend zoomend", () => {
    if (lastDetailFeature) refreshSelectedMonumentMarker();
  });
}

window.refreshSelectedMonumentMarker = refreshSelectedMonumentMarker;

/** Lexon një veti nga properties (provon edhe shkronja të mëdha). */
function val(props, key, fallback) {
  if (!props) return fallback || "—";
  return props[key] ?? props[key.toUpperCase()] ?? fallback ?? "—";
}

/** Emri i llojit të trashëgimisë për etiketën në panel. */
function llojiLabel(lloji) {
  if (typeof getHeritageTypeLabel === "function") {
    return getHeritageTypeLabel(lloji);
  }
  const s = typeof POINT_STYLES !== "undefined" ? POINT_STYLES[lloji] : null;
  if (s?.label) return s.label;
  return lloji || t("common.unknown");
}

/** Mbledh URL-t e mundshme të fotove (fushë, photos.json, rrugë lokale). */
function resolvePhotoUrls(props) {
  const id = val(props, "id", "");
  const urls = [];
  const seen = new Set();

  /** Shton URL në listë nëse nuk është dublikatë. */
  function add(url) {
    const u = (url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  }

  const fromField =
    props.foto_url ??
    props.foto_urls ??
    props.FOTO_URL ??
    props.FOTO_URLS;
  if (fromField && fromField !== "—") {
    String(fromField)
      .split(/[;|,]/)
      .forEach(add);
  }

  if (id && id !== "—" && photoIndex[id]) {
    const entry = photoIndex[id];
    const list = Array.isArray(entry) ? entry : [entry];
    list.forEach(add);
  }

  if (id && id !== "—") {
    const indexed = photoIndex[id];
    const hasIndexed = Array.isArray(indexed)
      ? indexed.length > 0
      : !!(indexed && String(indexed).trim());
    if (!hasIndexed) {
      const base =
        typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "";
      add(base + "images/monuments/" + id + ".jpg");
      add(base + "images/monuments/" + id + ".png");
      add(base + "images/monuments/" + id + "_2.jpg");
    }
  }

  return urls;
}

/** Kthen URL absolute për foto (http ose bazë e faqes). */
function toAbsoluteUrl(path) {
  if (typeof window.tkkResolveMediaUrl === "function") {
    return window.tkkResolveMediaUrl(path);
  }
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = window.location.href.replace(/\/[^/]*$/, "/");
  return base + path.replace(/^\//, "");
}

/** Vendos foton kryesore në #detailPhotoMain. */
function setMainPhoto(url, alt) {
  const wrap = document.getElementById("detailPhotoMainWrap");
  const img = document.getElementById("detailPhotoMain");
  if (!wrap || !img) return;
  img.referrerPolicy = "no-referrer";
  img.src = url;
  img.alt = alt || t("detail.photoAlt");
  wrap.hidden = false;
}

/** Nxjerr heritageId nga url_dtk, id ose shenime (për API DTK). */
function extractHeritageId(props) {
  if (!props) return null;
  const url = String(props.url_dtk || props.URL_DTK || "");
  let m = url.match(/heritageId=(\d+)/i);
  if (m) return m[1];
  const id = props.id ?? props.ID;
  if (id != null && /^\d+$/.test(String(id).trim())) return String(id).trim();
  const notes = String(props.shenime || props.SHENIME || "");
  m = notes.match(/heritageId=(\d+)/i);
  return m ? m[1] : null;
}

/** Lidhja për faqen e objektit në dtk.rks-gov.net. */
function resolveDtkPageUrl(props) {
  if (!props) return null;
  const raw = val(props, "url_dtk", "");
  if (raw && raw !== "—" && /^https?:\/\//i.test(raw)) return raw;
  const heritageId = extractHeritageId(props);
  if (heritageId) {
    return "https://dtk.rks-gov.net/Objekti?heritageId=" + heritageId;
  }
  return null;
}

/** Koordinatat WGS84 të monumentit (properties ose geometry Point). */
function resolveMonumentLatLng(feature) {
  if (!feature) return null;
  const p = feature.properties || {};
  let lat = parseFloat(p.lat ?? p.LAT);
  let lon = parseFloat(p.lon ?? p.LON ?? p.lng ?? p.LNG);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  const g = feature.geometry;
  if (g?.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    lon = Number(g.coordinates[0]);
    lat = Number(g.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }
  return null;
}

/** Vendos një lidhje të jashtme (Google Maps) ose e fsheh. */
function applyExternalMapLink(id, url, labelKey) {
  const link = document.getElementById(id);
  if (!link) return;
  link.textContent = t(labelKey);
  const show = !!(url && /^https?:\/\//i.test(url));
  if (show) {
    link.href = url;
    link.hidden = false;
    link.style.display = "flex";
  } else {
    link.removeAttribute("href");
    link.hidden = true;
    link.style.display = "none";
  }
}

/** Përditëson butonat e navigimit (GPS, nisje, monument → monument). */
function refreshMapsNavUi(feature) {
  const ll = feature ? resolveMonumentLatLng(feature) : null;
  const emri = feature
    ? String((feature.properties || {}).emri || "").trim()
    : "";
  const id = feature ? String((feature.properties || {}).id || "") : "";
  if (typeof refreshNavStartUi === "function") {
    refreshNavStartUi(ll ? ll.lat : NaN, ll ? ll.lon : NaN, emri, id);
  }
}

/** Shfaq ose fsheh lidhjet Google Maps, drejtimet dhe navigimin në WebGIS. */
function applyMapsLinks(feature) {
  const ll = feature ? resolveMonumentLatLng(feature) : null;
  const directionsUrl =
    ll && typeof buildGoogleMapsDirectionsUrl === "function"
      ? buildGoogleMapsDirectionsUrl(ll.lat, ll.lon, null)
      : ll
        ? "https://www.google.com/maps/dir/?api=1&destination=" +
          encodeURIComponent(ll.lat + "," + ll.lon) +
          "&travelmode=driving"
        : null;

  const show = !!ll;

  applyExternalMapLink(
    "detailMapsDirectionsLink",
    directionsUrl,
    "detail.mapsDirections"
  );
  applyExternalMapLink(
    "detailMapsDirectionsTab",
    directionsUrl,
    "detail.mapsDirections"
  );

  refreshMapsNavUi(feature || null);

  const empty = document.getElementById("detailMapsNoLink");
  if (empty) {
    empty.hidden = show;
    if (!show) empty.textContent = t("detail.mapsNoLink");
  }
}

/** Shfaq ose fsheh butonat «Shiko në DTK» në tab-et. */
function applyDtkLinks(dtkUrl) {
  const show = !!(dtkUrl && /^https?:\/\//i.test(dtkUrl));
  ["detailDtkLink", "detailDtkLinkTab"].forEach((id) => {
    const link = document.getElementById(id);
    if (!link) return;
    link.textContent = t("detail.dtkLink");
    if (show) {
      link.href = dtkUrl;
      link.hidden = false;
      link.style.display = "flex";
    } else {
      link.removeAttribute("href");
      link.hidden = true;
      link.style.display = "none";
    }
  });
  const empty = document.getElementById("detailDtkNoLink");
  if (empty) {
    empty.hidden = show;
    if (!show) empty.textContent = t("detail.dtkNoLink");
  }
}

/** Merr lista URL-sh fotosh nga serveri (/api/dtk-photos); në statik përdoret photos.json. */
function fetchDtkPhotoUrls(heritageId) {
  if (window.tkkIsStaticPublish) {
    return Promise.resolve([]);
  }
  return fetch(
    window.location.origin +
      "/api/dtk-photos?heritageId=" +
      encodeURIComponent(heritageId)
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const urls = data && Array.isArray(data.urls) ? data.urls : [];
      return urls.map((u) =>
        typeof window.tkkResolveMediaUrl === "function"
          ? window.tkkResolveMediaUrl(u)
          : u
      );
    })
    .catch(() => []);
}

/** Teston me Image() cilat URL ngarkohen me sukses. */
function probePhotoUrls(candidates) {
  return new Promise((resolve) => {
    const loaded = [];
    if (!candidates.length) {
      resolve(loaded);
      return;
    }

    let pending = candidates.length;
    candidates.forEach((raw) => {
      const url = toAbsoluteUrl(raw);
      const probe = new Image();
      probe.referrerPolicy = "no-referrer";
      probe.onload = () => {
        loaded.push(url);
        pending -= 1;
        if (pending === 0) resolve(loaded);
      };
      probe.onerror = () => {
        pending -= 1;
        if (pending === 0) resolve(loaded);
      };
      probe.src = url;
    });
  });
}

/** Galeria: placeholder, thumbnails, fallback DTK nëse lokale dështojnë. */
function renderDetailPhotos(props) {
  const placeholder = document.getElementById("detailPhotoPlaceholder");
  const thumbs = document.getElementById("detailPhotoThumbs");
  const mainWrap = document.getElementById("detailPhotoMainWrap");
  const emri = val(props, "emri");

  if (!placeholder || !thumbs) return;

  thumbs.innerHTML = "";
  if (mainWrap) mainWrap.hidden = true;

  const candidates = resolvePhotoUrls(props || {});
  if (!candidates.length && !extractHeritageId(props)) {
    placeholder.hidden = false;
    placeholder.textContent = t("detail.photoNone");
    return;
  }

  placeholder.hidden = false;
  placeholder.textContent = t("detail.photoLoading");

  /** Pas ngarkimit — shfaq foto ose mesazh gabimi. */
  function finish(loaded) {
    if (!loaded.length) {
      const id = val(props, "id", "");
      placeholder.hidden = false;
      placeholder.textContent = t("detail.photoDtkError");
      return;
    }
    placeholder.hidden = true;
    setMainPhoto(loaded[0], emri);
    thumbs.innerHTML = loaded
      .map(
        (url, i) =>
          '<button type="button" class="detail-photo-thumb-btn' +
          (i === 0 ? " is-active" : "") +
          '" data-photo-url="' +
          url.replace(/"/g, "&quot;") +
          '"><img src="' +
          url +
          '" alt="" /></button>'
      )
      .join("");

    thumbs.querySelectorAll(".detail-photo-thumb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        thumbs
          .querySelectorAll(".detail-photo-thumb-btn")
          .forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        setMainPhoto(btn.dataset.photoUrl, emri);
      });
    });
  }

  probePhotoUrls(candidates).then((loaded) => {
    if (loaded.length) {
      finish(loaded);
      return;
    }

    const heritageId = extractHeritageId(props);
    if (!heritageId) {
      finish([]);
      return;
    }

    placeholder.textContent = t("detail.photoDtkLoading");
    fetchDtkPhotoUrls(heritageId).then((dtkUrls) => {
      if (dtkUrls.length && props.id) {
        photoIndex[props.id] = dtkUrls;
      }
      probePhotoUrls(dtkUrls).then(finish);
    });
  });
}

/** Mbush dhe hap panelin e detajeve për një GeoJSON feature. */
function showDetailPanel(feature) {
  const panel = document.getElementById("detailPanel");
  if (!panel || !feature) return;

  lastDetailFeature = feature;
  window.lastDetailFeature = feature;
  const p = feature.properties || {};
  const disp =
    typeof translatePropsForDisplay === "function"
      ? translatePropsForDisplay(p)
      : null;
  const emri = disp ? disp.emri : val(p, "emri");
  const komuna = disp ? disp.komuna : val(p, "komuna");
  const lloji = val(p, "lloji_trashegimise");
  const periudha = disp
    ? disp.periudha
    : val(p, "periudha_detaj") !== "—"
      ? val(p, "periudha_detaj")
      : val(p, "periudha");
  const kategoria = disp ? disp.kategoria : val(p, "kategoria");
  const gjendja = disp ? disp.gjendja : val(p, "gjendja");
  const id = val(p, "id");
  const burimi = disp ? disp.burimi : val(p, "burimi");
  const dtkUrl = resolveDtkPageUrl(p);

  document.getElementById("detailTitle").textContent = emri;
  const tagEl = document.getElementById("detailTag");
  tagEl.textContent = llojiLabel(lloji);
  tagEl.className = "detail-tag detail-tag--" + (lloji || "");
  document.getElementById("detailLocation").textContent =
    komuna !== "—"
      ? tFormat("detail.locationKomuna", { komuna })
      : t("detail.locationKosovo");

  document.getElementById("detailPeriudha").textContent = periudha;
  const katEl = document.getElementById("detailKategoria");
  if (katEl) katEl.textContent = kategoria;
  document.getElementById("detailGjendja").textContent = gjendja;
  document.getElementById("detailId").textContent = id;
  document.getElementById("detailBurimi").textContent = burimi;

  applyDtkLinks(dtkUrl);
  applyMapsLinks(feature);
  renderDetailMonumentReports(p);

  renderDetailPhotos(p);
  ensureSelectedMonumentMapHooks();
  setSelectedMonumentMarker(feature);
  panel.classList.remove("is-closed");
  panel.classList.add("is-open");
}

/** Kthen panelin në gjendjen «Zgjidh një monument». */
function resetDetailPanel() {
  /** Vendos textContent për një element sipas id. */
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  lastDetailFeature = null;
  clearSelectedMonumentMarker();
  set("detailTitle", t("detail.selectTitle"));
  const tagEl = document.getElementById("detailTag");
  if (tagEl) {
    tagEl.textContent = t("common.unknown");
    tagEl.className = "detail-tag";
  }
  set("detailLocation", t("detail.clickMap"));
  set("detailPeriudha", "—");
  set("detailKategoria", "—");
  set("detailGjendja", "—");
  set("detailId", "—");
  set("detailBurimi", "—");

  applyDtkLinks(null);
  applyMapsLinks(null);
  renderDetailMonumentReports(null);

  const mainWrap = document.getElementById("detailPhotoMainWrap");
  const mainImg = document.getElementById("detailPhotoMain");
  const thumbs = document.getElementById("detailPhotoThumbs");
  const placeholder = document.getElementById("detailPhotoPlaceholder");
  if (mainWrap) mainWrap.hidden = true;
  if (mainImg) mainImg.removeAttribute("src");
  if (thumbs) thumbs.innerHTML = "";
  if (placeholder) placeholder.hidden = false;
}

/** Mbyll panelin dhe thërret resetDetailPanel. */
function closeDetailPanel(ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  const panel = document.getElementById("detailPanel");
  if (!panel) return;
  panel.classList.remove("is-open");
  panel.classList.add("is-closed");
  resetDetailPanel();
}

/** Rregullon URL-t në photos.json për bazën e aplikacionit. */
function rewritePhotoIndexEntry(entry) {
  const fix =
    typeof window.tkkResolveMediaUrl === "function"
      ? window.tkkResolveMediaUrl
      : (u) => u;
  if (Array.isArray(entry)) return entry.map(fix);
  return fix(entry);
}

/** Ngarkon data/photos.json në photoIndex. */
function loadPhotoIndex() {
  const base =
    typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "";
  return fetch(base + "data/photos.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      photoIndex = {};
      Object.keys(data || {}).forEach((key) => {
        if (key.startsWith("_")) return;
        photoIndex[key] = rewritePhotoIndexEntry(data[key]);
      });
    })
    .catch(() => {
      photoIndex = {};
    });
}

/** Format datë/ore për listën e raporteve (sq-AL ose en-GB). */
function formatReportDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const lang = typeof getLang === "function" && getLang() === "en" ? "en-GB" : "sq-AL";
    return d.toLocaleString(lang, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Etiketa e kategorisë së raportit VGI. */
function reportCategoryLabel(report) {
  const key = report?.category;
  if (key && typeof t === "function") {
    const label = t("report.cat." + key);
    if (label !== "report.cat." + key) return label;
  }
  return report?.categoryLabel || key || "—";
}

/** Zmadhon hartën te vendndodhja e raportit. */
function focusReportOnMap(report) {
  if (!window.map || !Number.isFinite(Number(report?.lat)) || !Number.isFinite(Number(report?.lon))) {
    return;
  }
  const latlng = L.latLng(Number(report.lat), Number(report.lon));
  window.map.setView(latlng, Math.max(window.map.getZoom(), 15), { animate: true });
}

/** Liston raportet VGI që lidhen me këtë monument. */
function renderDetailMonumentReports(props) {
  const listEl = document.getElementById("detailReportsList");
  const emptyEl = document.getElementById("detailReportsEmpty");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!props) {
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = t("detail.reportsEmpty");
    }
    return;
  }

  const load =
    typeof getReportsForMonument === "function"
      ? getReportsForMonument(props)
      : Promise.resolve([]);

  const propsId = val(props, "id", "");

  load.then((reports) => {
    if (!lastDetailFeature) return;
    const currentId = val(lastDetailFeature.properties || {}, "id", "");
    if (propsId !== currentId) return;

    if (!reports.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = t("detail.reportsEmpty");
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    reports.forEach((report) => {
      const li = document.createElement("li");
      li.className = "detail-reports__item";

      const cat = document.createElement("span");
      cat.className = "detail-reports__cat";
      cat.textContent = reportCategoryLabel(report);

      const desc = document.createElement("p");
      desc.className = "detail-reports__desc";
      const text = (report.description || "").trim();
      desc.textContent = text.length > 140 ? text.slice(0, 140) + "…" : text || "—";

      const meta = document.createElement("span");
      meta.className = "detail-reports__date";
      meta.textContent = formatReportDate(report.createdAt);

      const actions = document.createElement("div");
      actions.className = "detail-reports__actions";
      const mapBtn = document.createElement("button");
      mapBtn.type = "button";
      mapBtn.className = "detail-reports__map-btn";
      mapBtn.textContent = t("detail.reportsShowOnMap");
      mapBtn.addEventListener("click", () => focusReportOnMap(report));
      actions.appendChild(mapBtn);

      li.appendChild(cat);
      li.appendChild(desc);
      li.appendChild(meta);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  });
}

/** Rifreskon raportet nëse paneli është hapur. */
function refreshDetailMonumentReports() {
  if (lastDetailFeature?.properties) {
    renderDetailMonumentReports(lastDetailFeature.properties);
  }
}

/** Tab-et INFO / FOTO / DTK / MAPS në panel. */
function initDetailTabs() {
  const tabs = document.querySelectorAll(".detail-tab[data-tab]");
  const panels = {
    info: document.getElementById("detailTabInfo"),
    foto: document.getElementById("detailTabFoto"),
    dtk: document.getElementById("detailTabDtk"),
    maps: document.getElementById("detailTabMaps"),
  };
  const photos = document.getElementById("detailPhotos");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      Object.keys(panels).forEach((k) => {
        if (panels[k]) panels[k].classList.toggle("active", k === key);
      });
      if (photos) {
        photos.style.display = key === "foto" || key === "info" ? "" : "none";
      }
    });
  });
}

// Inicializim kur faqja është gati
document.addEventListener("DOMContentLoaded", () => {
  loadPhotoIndex();
  initDetailTabs();
  const btn = document.getElementById("detailClose");
  if (btn) {
    btn.addEventListener("click", closeDetailPanel);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closeDetailPanel(e);
      }
    });
  }
});

/** Rindërton panelin pas ndërrimit të gjuhës. */
function refreshDetailPanelI18n() {
  const panel = document.getElementById("detailPanel");
  if (!panel) return;
  if (panel.classList.contains("is-open") && lastDetailFeature) {
    showDetailPanel(lastDetailFeature);
  } else {
    resetDetailPanel();
  }
  const heading = document.getElementById("detailReportsHeading");
  if (heading) heading.textContent = t("detail.reportsTitle");
}

window.showDetailPanel = showDetailPanel;
window.refreshMapsNavUi = refreshMapsNavUi;
window.resolveMonumentLatLng = resolveMonumentLatLng;
window.refreshDetailPanelI18n = refreshDetailPanelI18n;
window.refreshDetailMonumentReports = refreshDetailMonumentReports;
window.renderDetailMonumentReports = renderDetailMonumentReports;
