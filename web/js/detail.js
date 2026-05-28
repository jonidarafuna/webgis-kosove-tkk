/** Panel detajesh + foto kur klikohet pika */

let photoIndex = {};
let lastDetailFeature = null;

function val(props, key, fallback) {
  if (!props) return fallback || "—";
  return props[key] ?? props[key.toUpperCase()] ?? fallback ?? "—";
}

function llojiLabel(lloji) {
  if (typeof getHeritageTypeLabel === "function") {
    return getHeritageTypeLabel(lloji);
  }
  const s = typeof POINT_STYLES !== "undefined" ? POINT_STYLES[lloji] : null;
  if (s?.label) return s.label;
  return lloji || t("common.unknown");
}

function resolvePhotoUrls(props) {
  const id = val(props, "id", "");
  const urls = [];
  const seen = new Set();

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
    add("images/monuments/" + id + ".jpg");
    add("images/monuments/" + id + ".png");
    add("images/monuments/" + id + "_2.jpg");
  }

  return urls;
}

function toAbsoluteUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) {
    const m = path.match(/dtk\.rks-gov\.net\/files(\/.+)/i);
    if (m) return window.location.origin + "/dtk-files" + m[1];
    return path;
  }
  if (path.startsWith("/dtk-files")) return window.location.origin + path;
  const base = window.location.href.replace(/\/[^/]*$/, "/");
  return base + path.replace(/^\//, "");
}

function setMainPhoto(url, alt) {
  const wrap = document.getElementById("detailPhotoMainWrap");
  const img = document.getElementById("detailPhotoMain");
  if (!wrap || !img) return;
  img.src = url;
  img.alt = alt || t("detail.photoAlt");
  wrap.hidden = false;
}

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

function fetchDtkPhotoUrls(heritageId) {
  return fetch(
    "/api/dtk-photos?heritageId=" + encodeURIComponent(heritageId)
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => (data && Array.isArray(data.urls) ? data.urls : []))
    .catch(() => []);
}

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
  document.getElementById("detailLloji").textContent = kategoria;
  document.getElementById("detailGjendja").textContent = gjendja;
  document.getElementById("detailId").textContent = id;
  document.getElementById("detailBurimi").textContent = burimi;

  applyDtkLinks(dtkUrl);
  renderDetailMonumentReports(p);

  renderDetailPhotos(p);
  panel.classList.remove("is-closed");
  panel.classList.add("is-open");
}

function resetDetailPanel() {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  lastDetailFeature = null;
  set("detailTitle", t("detail.selectTitle"));
  const tagEl = document.getElementById("detailTag");
  if (tagEl) {
    tagEl.textContent = t("common.unknown");
    tagEl.className = "detail-tag";
  }
  set("detailLocation", t("detail.clickMap"));
  set("detailPeriudha", "—");
  set("detailLloji", "—");
  set("detailGjendja", "—");
  set("detailId", "—");
  set("detailBurimi", "—");

  applyDtkLinks(null);
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

function loadPhotoIndex() {
  return fetch("data/photos.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      photoIndex = data || {};
      delete photoIndex._info;
    })
    .catch(() => {
      photoIndex = {};
    });
}

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

function reportCategoryLabel(report) {
  const key = report?.category;
  if (key && typeof t === "function") {
    const label = t("report.cat." + key);
    if (label !== "report.cat." + key) return label;
  }
  return report?.categoryLabel || key || "—";
}

function focusReportOnMap(report) {
  if (!window.map || !Number.isFinite(Number(report?.lat)) || !Number.isFinite(Number(report?.lon))) {
    return;
  }
  const latlng = L.latLng(Number(report.lat), Number(report.lon));
  window.map.setView(latlng, Math.max(window.map.getZoom(), 15), { animate: true });
}

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

function refreshDetailMonumentReports() {
  if (lastDetailFeature?.properties) {
    renderDetailMonumentReports(lastDetailFeature.properties);
  }
}

function initDetailTabs() {
  const tabs = document.querySelectorAll(".detail-tab[data-tab]");
  const panels = {
    info: document.getElementById("detailTabInfo"),
    foto: document.getElementById("detailTabFoto"),
    dtk: document.getElementById("detailTabDtk"),
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
window.refreshDetailPanelI18n = refreshDetailPanelI18n;
window.refreshDetailMonumentReports = refreshDetailMonumentReports;
window.renderDetailMonumentReports = renderDetailMonumentReports;
