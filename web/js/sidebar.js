/**
 * QËLLIMI: Paneli anësor — numërim monumentesh, ndezje shtresash, kërkim me histori,
 *           panel i mbyllur (rail) dhe flyout për kërkim/filtra/statistikë.
 * KUR NGARKOHET: DOMContentLoaded; numërimi përditësohet pas ngarkimit të monumenteve.
 * LIDHET ME: index.html (#sidebarLeft, #sidebarSearch), map.js, detail.js, i18n.js,
 *             symbology-user.js, filters.js, chart.js (flyout statistikë).
 */

// Konstante për flyout dhe kërkim (localStorage: tkkSearchHistory)
const SIDEBAR_FLYOUT_W = 220;
const SEARCH_HISTORY_KEY = "tkkSearchHistory";
const SEARCH_HISTORY_MAX = 12;
const SEARCH_PREVIEW_LIMIT = 3;
const SEARCH_EXPANDED_LIMIT = 40;

let lastSearchQuery = "";
let lastSearchMatches = [];
let searchShowAll = false;

// ——— Numërimi dhe ikonat e shtresave ———

/** Numëron monumentet sipas lloji_trashegimise (registry ose allMonumentFeatures). */
function countByType() {
  const counts = { arkeologjike: 0, arkitekturore: 0, luajtshme: 0 };
  const registry = window.monumentRegistry || [];
  if (registry.length) {
    registry.forEach(({ layer, feature }) => {
      const k =
        (layer && layer._tkkType) ||
        (feature.properties || {}).lloji_trashegimise;
      if (counts[k] !== undefined) counts[k]++;
    });
    return counts;
  }
  (window.allMonumentFeatures || []).forEach((f) => {
    const l = (f.properties || {}).lloji_trashegimise;
    if (counts[l] !== undefined) counts[l]++;
  });
  return counts;
}

/** Vendos tekstin «N monumente» pranë çdo shtrese në listë. */
function updateLayerCounts() {
  const counts = countByType();
  document.querySelectorAll("[data-count-for]").forEach((el) => {
    const key = el.dataset.countFor;
    const n = counts[key];
    el.textContent = n !== undefined ? n + " " + t("common.monuments") : "—";
  });
}

/** Mbush ikonat SVG/PNG në legjendën e shtresave. */
function fillLayerIcons() {
  ["arkeologjike", "arkitekturore", "luajtshme"].forEach((key) => {
    const slot = document.querySelector('[data-icon="' + key + '"]');
    if (!slot) return;
    if (typeof window.monumentIconHtml === "function") {
      const styleOverride =
        typeof window.getTypePointStyle === "function"
          ? window.getTypePointStyle(key)
          : null;
      slot.innerHTML = window.monumentIconHtml(
        key,
        "tkk-pin--legend",
        styleOverride
      );
      return;
    }
    const url = getMonumentIconUrl(key);
    if (url) {
      slot.innerHTML = '<img src="' + url + '" alt="" width="22" height="22" />';
    }
  });
}

/** Ndryshon checkbox-in e një rreshti shtrese (klik në rresht). */
function toggleLayerRow(row) {
  const input = row.querySelector("input.layer-row-input");
  if (!input) return;
  input.checked = !input.checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  row.classList.toggle("is-off", !input.checked);
}

/** Lidh klik/keyboard për .layer-row dhe sinkronizon shtresat administrative. */
function initLayerToggles() {
  document.querySelectorAll(".layer-row[data-layer]").forEach((row) => {
    const input = row.querySelector("input.layer-row-input");
    if (!input) return;

    row.classList.toggle("is-off", !input.checked);

    row.addEventListener("click", (e) => {
      e.preventDefault();
      if (e.target.closest("input")) return;
      toggleLayerRow(row);
    });

    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleLayerRow(row);
      }
    });

    input.addEventListener("change", () => {
      row.classList.toggle("is-off", !input.checked);
    });
  });

  if (typeof window.syncScaleDependentAdminLayers === "function") {
    window.syncScaleDependentAdminLayers();
  }
}

// ——— Kërkimi i monumenteve ———

/** Normalizon tekstin për kërkim (minuscule, pa theks). */
function normalizeSearch(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Escape HTML në rezultatet e kërkimit. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lexon një fushë nga properties (emri, komuna, …). */
function searchProp(props, key) {
  if (!props) return "";
  const v = props[key] ?? props[key.toUpperCase()];
  return v != null && String(v).trim() !== "" ? String(v).trim() : "";
}

/** Etiketa e llojit në rreshtin e rezultatit. */
function searchCategoryLabel(type) {
  if (typeof getHeritageTypeLabel === "function") {
    return getHeritageTypeLabel(type);
  }
  const s = typeof POINT_STYLES !== "undefined" ? POINT_STYLES[type] : null;
  return s?.label || type || "Monument";
}

/** Teksti në të cilin kërkohet (emri + emri EN nëse gjuha është en). */
function monumentSearchHaystack(props) {
  const p = props || {};
  const sq = normalizeSearch(p.emri || p.EMRI || "");
  if (
    typeof getLang === "function" &&
    getLang() === "en" &&
    typeof getMonumentDisplayName === "function"
  ) {
    return sq + " " + normalizeSearch(getMonumentDisplayName(p));
  }
  return sq;
}

/** Lista e feature-ve që përmbajnë query (min. 2 karaktere). */
function getSearchMatches(query) {
  const q = normalizeSearch(query.trim());
  if (q.length < 2) return [];
  return (window.allMonumentFeatures || []).filter((f) =>
    monumentSearchHaystack(f.properties).includes(q)
  );
}

/** Shfaq/fsheh butonin X te fusha e kërkimit. */
function updateSearchClearButton() {
  const input = document.getElementById("sidebarSearch");
  const clearBtn = document.getElementById("sidebarSearchClear");
  if (!input || !clearBtn) return;
  const hasValue = input.value.trim().length > 0;
  clearBtn.hidden = !hasValue;
}

/** Kontrollon nëse dropdown-i duhet të jetë i dukshëm. */
function syncSearchDropdown() {
  const dropdown = document.getElementById("sidebarSearchDropdown");
  const results = document.getElementById("sidebarSearchResults");
  const historyWrap = document.getElementById("sidebarSearchHistoryWrap");
  const showAllBtn = document.getElementById("sidebarSearchShowAll");
  const input = document.getElementById("sidebarSearch");
  if (!dropdown) return;

  const q = normalizeSearch((input?.value || "").trim());
  const hasResults = results && results.children.length > 0;
  const hasHistory =
    historyWrap && !historyWrap.hidden && q.length < 2;
  const hasShowAll = showAllBtn && !showAllBtn.hidden;

  dropdown.hidden = !(hasResults || hasHistory || hasShowAll);
}

/** Lexon historinë e kërkimeve nga localStorage. */
function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === "string" && item.trim().length >= 2)
      .slice(0, SEARCH_HISTORY_MAX);
  } catch {
    return [];
  }
}

/** Ruan historinë (max SEARCH_HISTORY_MAX). */
function saveSearchHistory(items) {
  try {
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(items.slice(0, SEARCH_HISTORY_MAX))
    );
  } catch {
    /* localStorage i plotë ose i bllokuar */
  }
}

/** Shton një kërkim në krye të historisë. */
function pushSearchHistory(text) {
  const label = (text || "").trim();
  if (label.length < 2) return;

  const norm = normalizeSearch(label);
  const next = [
    label,
    ...loadSearchHistory().filter((item) => normalizeSearch(item) !== norm),
  ];
  saveSearchHistory(next);
  renderSearchHistory();
}

/** Fshin të gjithë historinë e kërkimit. */
function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
  renderSearchHistory();
}

/** Gjen monumentin e parë që përputhet (saktë ose pjesërisht). */
function findMonumentByQuery(query) {
  const q = normalizeSearch(query.trim());
  if (q.length < 2) return null;

  const features = window.allMonumentFeatures || [];
  const exact = features.find(
    (f) => monumentSearchHaystack(f.properties) === q
  );
  if (exact) return exact;

  return (
    features.find((f) => monumentSearchHaystack(f.properties).includes(q)) ||
    null
  );
}

/** Shfaq/fsheh seksionin «Kërkimet e fundit». */
function setSearchHistoryVisible(visible) {
  const wrap = document.getElementById("sidebarSearchHistoryWrap");
  if (!wrap) return;
  wrap.hidden = !visible;
  syncSearchDropdown();
}

/** Vizaton butonat e historisë së kërkimit. */
function renderSearchHistory() {
  const list = document.getElementById("sidebarSearchHistory");
  const input = document.getElementById("sidebarSearch");
  if (!list) return;

  const items = loadSearchHistory();
  list.innerHTML = "";

  if (items.length === 0) {
    setSearchHistoryVisible(false);
    return;
  }

  const q = normalizeSearch((input?.value || "").trim());
  if (q.length >= 2) {
    setSearchHistoryVisible(false);
    return;
  }

  items.forEach((label) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-history-btn";
    btn.innerHTML =
      '<svg class="search-history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
      '<path d="M3 12a9 9 0 1 0 9-9 7 7 0 0 0-4 1.5" />' +
      '<path d="M3 4v4h4" />' +
      "</svg><span></span>";
    btn.querySelector("span").textContent = label;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (input) input.value = label;
      const feature = findMonumentByQuery(label);
      const results = document.getElementById("sidebarSearchResults");
      if (feature) {
        goToMonument(feature, { skipHistory: true });
        closeSearchDropdown();
      } else {
        runMonumentSearch(label);
      }
    });

    li.appendChild(btn);
    list.appendChild(li);
  });

  setSearchHistoryVisible(true);
}

/** Zmadhon hartën te monumenti dhe hap detajet. */
function goToMonument(feature, options) {
  const p = feature.properties || {};
  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon) || !window.map) return;

  const latlng = L.latLng(lat, lon);
  window.map.setView(latlng, Math.max(window.map.getZoom(), 14), {
    animate: true,
  });

  if (typeof handleMonumentMapClick === "function") {
    handleMonumentMapClick(latlng, feature, null);
  } else if (typeof showDetailPanel === "function") {
    showDetailPanel(feature);
  }

  const input = document.getElementById("sidebarSearch");
  const name = p.emri || "";
  if (input) input.value = name;

  if (!options?.skipHistory) {
    pushSearchHistory(name || input?.value || "");
  }
}

/** HTML për një rresht rezultati (ikonë, emër, lloj, komuna). */
function buildSearchResultRowHtml(f) {
  const p = f.properties || {};
  const type = p.lloji_trashegimise || "";
  const url = getMonumentIconUrl(type);
  const rawEmri = searchProp(p, "emri") || "—";
  const emri =
    typeof translateDataValue === "function"
      ? translateDataValue("emri", rawEmri, p)
      : rawEmri;
  const rawKomuna = searchProp(p, "komuna") || t("common.kosovo");
  const komuna =
    typeof translateDataValue === "function"
      ? translateDataValue("komuna", rawKomuna, p)
      : rawKomuna;
  const category = searchCategoryLabel(type);
  const iconHtml = url
    ? '<img class="search-result-icon" src="' +
      escapeHtml(url) +
      '" alt="" width="22" height="22" />'
    : '<span class="search-result-icon search-result-icon--placeholder" aria-hidden="true">◆</span>';

  return (
    iconHtml +
    '<span class="search-result-body">' +
    '<span class="search-result-title">' +
    escapeHtml(emri) +
    "</span>" +
    '<span class="search-result-meta">' +
    '<span class="search-result-type search-result-type--' +
    escapeHtml(type) +
    '">' +
    escapeHtml(category) +
    "</span>" +
    " · " +
    escapeHtml(komuna) +
    "</span></span>"
  );
}

/** Liston rezultatet ose mesazhin «nuk u gjet». */
function renderSearchResults(matches, query, options) {
  const listEl = document.getElementById("sidebarSearchResults");
  const showAllBtn = document.getElementById("sidebarSearchShowAll");
  if (!listEl) return;

  const label = (query || "").trim();
  const expanded = options?.showAll || searchShowAll;
  const limit = expanded ? SEARCH_EXPANDED_LIMIT : SEARCH_PREVIEW_LIMIT;
  const visible = matches.slice(0, limit);

  listEl.innerHTML = "";
  setSearchHistoryVisible(false);

  if (!visible.length && label.length >= 2) {
    const li = document.createElement("li");
    li.className = "search-result-item search-result-item--empty";
    li.innerHTML =
      '<p class="search-empty-msg">' + t("search.empty") + "</p>";
    listEl.appendChild(li);
    if (showAllBtn) showAllBtn.hidden = true;
    syncSearchDropdown();
    return;
  }

  visible.forEach((f) => {
    const li = document.createElement("li");
    li.className = "search-result-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result-btn";
    btn.innerHTML = buildSearchResultRowHtml(f);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      goToMonument(f);
      closeSearchDropdown();
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  });

  if (showAllBtn) {
    if (matches.length > SEARCH_PREVIEW_LIMIT && !expanded) {
      showAllBtn.hidden = false;
      showAllBtn.textContent = tFormat("search.showAll", { q: label });
    } else {
      showAllBtn.hidden = true;
      showAllBtn.textContent = "";
    }
  }

  syncSearchDropdown();
}

/** Pastron listën e rezultateve dhe fsheh dropdown-in. */
function closeSearchDropdown() {
  const listEl = document.getElementById("sidebarSearchResults");
  const showAllBtn = document.getElementById("sidebarSearchShowAll");
  if (listEl) listEl.innerHTML = "";
  if (showAllBtn) {
    showAllBtn.hidden = true;
    showAllBtn.textContent = "";
  }
  searchShowAll = false;
  syncSearchDropdown();
}

/** Ekzekuton kërkimin kur ndryshon teksti në input. */
function runMonumentSearch(query) {
  const q = normalizeSearch(query.trim());
  updateSearchClearButton();

  if (q.length < 2) {
    lastSearchQuery = "";
    lastSearchMatches = [];
    window.tkkLastSearchQuery = "";
    window.tkkLastSearchMatches = [];
    searchShowAll = false;
    closeSearchDropdown();
    renderSearchHistory();
    return;
  }

  lastSearchQuery = query.trim();
  lastSearchMatches = getSearchMatches(query);
  window.tkkLastSearchQuery = lastSearchQuery;
  window.tkkLastSearchMatches = lastSearchMatches.slice();
  renderSearchResults(lastSearchMatches, lastSearchQuery, {
    showAll: searchShowAll,
  });
}

/** Lidh input, focus, Enter për një fushë kërkimi. */
function initSearchInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", () => {
    if (
      normalizeSearch(input.value.trim()) !== normalizeSearch(lastSearchQuery)
    ) {
      searchShowAll = false;
    }
    runMonumentSearch(input.value);
  });

  input.addEventListener("focus", () => {
    updateSearchClearButton();
    if (normalizeSearch(input.value.trim()).length < 2) {
      renderSearchHistory();
    } else {
      syncSearchDropdown();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const label = input.value.trim();
    const q = normalizeSearch(label);
    if (q.length < 2) return;
    pushSearchHistory(label);
    const feature = findMonumentByQuery(label);
    if (feature) {
      goToMonument(feature, { skipHistory: true });
      closeSearchDropdown();
    }
  });
}

/** Inicializon kërkimin e sidebar-it (clear, show all, histori). */
function initSidebarSearch() {
  initSearchInput("sidebarSearch");
  renderSearchHistory();
  updateSearchClearButton();

  document.getElementById("sidebarSearchClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = document.getElementById("sidebarSearch");
    if (input) input.value = "";
    lastSearchQuery = "";
    lastSearchMatches = [];
    searchShowAll = false;
    updateSearchClearButton();
    closeSearchDropdown();
    renderSearchHistory();
    input?.focus();
  });

  document.getElementById("sidebarSearchShowAll")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    searchShowAll = true;
    renderSearchResults(lastSearchMatches, lastSearchQuery, { showAll: true });
  });

  document.getElementById("sidebarSearchHistoryClear")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearSearchHistory();
  });

  document.addEventListener("click", (e) => {
    const flyout = document.getElementById("sidebarFlyoutSearch");
    const input = document.getElementById("sidebarSearch");
    if (!flyout || !flyout.classList.contains("is-open")) return;
    if (!flyout.contains(e.target)) {
      closeSearchDropdown();
      if (input && normalizeSearch(input.value.trim()).length < 2) {
        renderSearchHistory();
      }
    }
  });
}

/** Thirret pas ngarkimit të të dhënave — ikona dhe numërim. */
function initSidebar() {
  fillLayerIcons();
  updateLayerCounts();
}

// ——— Paneli i mbyllur (rail) dhe flyout ———

/** Thekson butonin aktiv në shiritin e ngushtë. */
function setRailActive(section) {
  document.querySelectorAll(".sidebar-rail-btn[data-sidebar-section]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.sidebarSection === section);
  });
}

/** Menaxhon mbylljen e panelit, flyout search/filters/chart dhe localStorage. */
function initSidebarCollapse() {
  const layout = document.getElementById("appLayout");
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const rail = document.getElementById("sidebarRail");
  const sidebarLeft = document.getElementById("sidebarLeft");
  const flyoutSearch = document.getElementById("sidebarFlyoutSearch");
  const flyoutFilters = document.getElementById("sidebarFlyoutFilters");
  const flyoutChart = document.getElementById("sidebarFlyoutChart");
  if (!layout || !collapseBtn || !rail || !sidebarLeft) return;

  const STORAGE_KEY = "tkkSidebarCollapsed";
  let setSidebarCollapsed;
  let activeFlyout = null;

  /** Rregullon gjerësinë e kolonës kur flyout është hapur. */
  function updateFlyoutGrid() {
    const collapsed = layout.classList.contains("layout--sidebar-collapsed");
    if (!activeFlyout) {
      layout.style.removeProperty("--sidebar-col-w");
      return;
    }
    if (collapsed) {
      layout.style.setProperty(
        "--sidebar-col-w",
        "calc(var(--sidebar-rail-w, 2.75rem) + " + SIDEBAR_FLYOUT_W + "px)"
      );
    } else {
      layout.style.setProperty("--sidebar-col-w", "248px");
    }
  }

  /** Mbyll të gjitha flyout-et dhe kthen fokusin te shtresat. */
  function closeFlyouts() {
    activeFlyout = null;
    flyoutSearch?.classList.remove("is-open");
    flyoutFilters?.classList.remove("is-open");
    flyoutChart?.classList.remove("is-open");
    if (flyoutSearch) flyoutSearch.hidden = true;
    if (flyoutFilters) flyoutFilters.hidden = true;
    if (flyoutChart) flyoutChart.hidden = true;
    layout.classList.remove("layout--flyout-open");
    sidebarLeft.classList.remove("is-suppressed");
    updateFlyoutGrid();
    setRailActive(null);
  }

  /** Hap flyout search, filters ose chart. */
  function openFlyout(name) {
    closeFlyouts();
    activeFlyout = name;
    const flyout =
      name === "search"
        ? flyoutSearch
        : name === "filters"
          ? flyoutFilters
          : name === "chart"
            ? flyoutChart
            : null;
    if (!flyout) return;

    sidebarLeft.classList.add("is-suppressed");
    flyout.hidden = false;
    flyout.classList.add("is-open");
    layout.classList.add("layout--flyout-open");
    setRailActive(name);
    updateFlyoutGrid();

    if (name === "search") {
      window.setTimeout(() => {
        updateSearchClearButton();
        renderSearchHistory();
        document.getElementById("sidebarSearch")?.focus();
      }, 200);
    }
  }

  /** Kthen panelin e plotë të shtresave (jo flyout). */
  function openLayersPanel() {
    closeFlyouts();
    if (!(typeof window.tkkIsMobile === "function" && window.tkkIsMobile())) {
      setSidebarCollapsed(false);
    } else {
      sidebarLeft?.classList.remove("is-suppressed");
    }
    setRailActive("layers");
  }

  /** Mbyll/zgjeron sidebar-in dhe rifreskon madhësinë e hartës. */
  setSidebarCollapsed = function (collapsed) {
    layout.classList.toggle("layout--sidebar-collapsed", collapsed);
    collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    rail.setAttribute("aria-hidden", collapsed ? "false" : "true");
    if (collapsed && activeFlyout) {
      updateFlyoutGrid();
    }
    if (collapsed && !activeFlyout) {
      closeFlyouts();
    }
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    updateSidebarChromeI18n();
    window.setTimeout(() => {
      if (typeof window.tkkIsMobile === "function" && window.tkkIsMobile()) {
        return;
      }
      if (typeof window.tkkInvalidateMapSize === "function") {
        window.tkkInvalidateMapSize();
      } else if (window.map && typeof window.map.invalidateSize === "function") {
        window.map.invalidateSize({ animate: false, pan: false });
      }
    }, 300);
  };

  window.setSidebarCollapsed = setSidebarCollapsed;

  /** Drejton klikimin në rail (shtresa, kërkim, filtra, grafik). */
  function handleSidebarAction(section) {
    if (section === "layers") {
      openLayersPanel();
      return;
    }
    if (section === "search" || section === "filters" || section === "chart") {
      if (activeFlyout === section) {
        openLayersPanel();
        return;
      }
      const collapsed = layout.classList.contains("layout--sidebar-collapsed");
      if (collapsed) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
      openFlyout(section);
    }
  }

  if (localStorage.getItem(STORAGE_KEY) === "1") {
    setSidebarCollapsed(true);
  }

  collapseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeFlyouts();
    setSidebarCollapsed(true);
  });

  rail.querySelectorAll("[data-sidebar-section]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleSidebarAction(btn.dataset.sidebarSection || "layers");
    });
  });

  document.querySelectorAll("[data-flyout-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSidebarAction(btn.dataset.flyoutOpen);
    });
  });

  document.querySelectorAll("[data-flyout-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openLayersPanel();
    });
  });

  rail.querySelectorAll("[data-rail-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = btn.dataset.railAction;

      if (action === "timeline") {
        document
          .getElementById("timelinePanel")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      if (action === "info") {
        document.getElementById("timelineInfo")?.click();
      }
    });
  });

  window.tkkOpenFlyout = openFlyout;
  window.tkkCloseFlyouts = closeFlyouts;
  window.tkkOpenLayersPanel = openLayersPanel;
}

/** Përditëson title/aria-label të butonit mbylljes sipas gjuhës. */
function updateSidebarChromeI18n() {
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const layout = document.querySelector(".layout");
  if (collapseBtn && layout) {
    const collapsed = layout.classList.contains("layout--sidebar-collapsed");
    collapseBtn.title = collapsed ? t("sidebar.expand") : t("sidebar.collapse");
    collapseBtn.setAttribute("aria-label", collapseBtn.title);
  }
}

/** Rindërton rezultatet ose historinë pas ndërrimit të gjuhës. */
function refreshSearchI18n() {
  if (lastSearchQuery && lastSearchQuery.length >= 2) {
    renderSearchResults(lastSearchMatches, lastSearchQuery, {
      showAll: searchShowAll,
    });
  } else {
    renderSearchHistory();
  }
}

// Inicializim dhe eksport global
document.addEventListener("DOMContentLoaded", () => {
  initLayerToggles();
  initSidebarSearch();
  initSidebarCollapse();
  fillLayerIcons();
  updateSidebarChromeI18n();
});

window.updateLayerCounts = updateLayerCounts;
window.fillLayerIcons = fillLayerIcons;
window.initSidebar = initSidebar;
window.refreshSearchI18n = refreshSearchI18n;
window.updateSidebarChromeI18n = updateSidebarChromeI18n;
window.tkkGetMonumentSearchMatches = getSearchMatches;
window.tkkFindMonumentByQuery = findMonumentByQuery;
window.tkkBuildSearchResultRowHtml = buildSearchResultRowHtml;
