/**
 * QËLLIMI: Lejon përdoruesin të ndryshojë ngjyrën e pin-ave për tre llojet e trashëgimisë
 *           (ruhet në localStorage) dhe rifreskon markerët në hartë.
 */

const USER_COLORS_STORAGE_KEY = "tkkUserPointStyles";
const FILTER_HIGHLIGHT_STORAGE_KEY = "tkkFilterHighlightColor";
const FILTER_HIGHLIGHT_KEY = "filterHighlight";
const DEFAULT_FILTER_HIGHLIGHT = "#ef4444";
const HERITAGE_TYPES = ["arkeologjike", "arkitekturore", "luajtshme"];
const MUTED_FILTER_STYLE = { fill: "#94a3b8", stroke: "#64748b" };

let filterHighlightColor = DEFAULT_FILTER_HIGHLIGHT;

const COLOR_PRESETS = [
  "#FC8D62",
  "#8DA0CB",
  "#66C2A5",
  "#f97316",
  "#ea580c",
  "#2dd4bf",
  "#38bdf8",
  "#a3e635",
  "#64748b",
  "#1e293b",
];

let userPointStyles = {};
let symbologyInitialized = false;
let openPickerType = null;

function getDefaultTypeStyle(typeKey) {
  const base =
    (typeof POINT_STYLES !== "undefined" && POINT_STYLES[typeKey]) ||
    {};
  return {
    fill: base.fill || "#64748b",
    stroke: base.stroke || base.fill || "#64748b",
  };
}

function loadUserColors() {
  userPointStyles = {};
  filterHighlightColor = DEFAULT_FILTER_HIGHLIGHT;
  try {
    const raw = localStorage.getItem(USER_COLORS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        userPointStyles = parsed;
      }
    }
  } catch (_) {
    userPointStyles = {};
  }

  try {
    const savedHighlight = localStorage.getItem(FILTER_HIGHLIGHT_STORAGE_KEY);
    const parsed = normalizeColorInputValue(savedHighlight);
    if (parsed) filterHighlightColor = parsed;
  } catch {
    filterHighlightColor = DEFAULT_FILTER_HIGHLIGHT;
  }

  applyFilterHighlightCssVars(filterHighlightColor);
}

function hexToRgba(hex, alpha) {
  const h = normalizeColorInputValue(hex);
  if (!h) return null;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyFilterHighlightCssVars(hex) {
  const color = normalizeColorInputValue(hex) || DEFAULT_FILTER_HIGHLIGHT;
  document.documentElement.style.setProperty("--tkk-filter-mask", color);
  document.documentElement.style.setProperty("--tkk-filter-glow", color);
  document.documentElement.style.setProperty(
    "--tkk-filter-glow-soft",
    hexToRgba(color, 0.55) || "rgba(239, 68, 68, 0.55)"
  );
}

function getFilterHighlightColor() {
  return normalizeColorInputValue(filterHighlightColor) || DEFAULT_FILTER_HIGHLIGHT;
}

function saveFilterHighlightColor() {
  try {
    localStorage.setItem(FILTER_HIGHLIGHT_STORAGE_KEY, getFilterHighlightColor());
  } catch (_) {
    /* ignore */
  }
}

function setFilterHighlightColor(fill, closePicker) {
  const normalized = normalizeColorInputValue(fill);
  if (!normalized) return;
  filterHighlightColor = normalized;
  saveFilterHighlightColor();
  applyFilterHighlightCssVars(normalized);
  syncFilterHighlightInput();
  refreshMonumentSymbology();
  if (closePicker) closeColorPicker();
}

function saveUserColors() {
  try {
    localStorage.setItem(
      USER_COLORS_STORAGE_KEY,
      JSON.stringify(userPointStyles)
    );
  } catch (_) {
    /* ignore */
  }
}

function getTypePointStyle(typeKey) {
  const def = getDefaultTypeStyle(typeKey);
  const custom = userPointStyles[typeKey];
  if (!custom) return { ...def };
  return {
    fill: custom.fill || def.fill,
    stroke: custom.stroke || def.stroke,
  };
}

function getStyleForFeature(feature, typeKey) {
  const key = typeKey || "arkeologjike";
  const base = getTypePointStyle(key);

  const filtersActive =
    typeof window.hasActiveMonumentFilters === "function" &&
    window.hasActiveMonumentFilters();

  if (!filtersActive || !feature) {
    return { fill: base.fill, stroke: base.stroke, key, muted: false, filtered: false };
  }

  const matches =
    typeof window.featureMatchesMonumentFilters === "function" &&
    window.featureMatchesMonumentFilters(feature, key);

  if (matches) {
    return {
      fill: base.fill,
      stroke: base.stroke,
      key,
      muted: false,
      filtered: true,
      filterMask: getFilterHighlightColor(),
    };
  }

  return {
    fill: MUTED_FILTER_STYLE.fill,
    stroke: MUTED_FILTER_STYLE.stroke,
    key,
    muted: true,
    filtered: false,
  };
}

function normalizeColorInputValue(hex) {
  let h = String(hex || "").trim();
  if (!h.startsWith("#")) h = "#" + h.replace(/^#/, "");
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return (
      "#" +
      h[1] +
      h[1] +
      h[2] +
      h[2] +
      h[3] +
      h[3]
    ).toLowerCase();
  }
  return null;
}

function setUserTypeColor(typeKey, fill, closePicker) {
  if (!HERITAGE_TYPES.includes(typeKey)) return;
  const normalized = normalizeColorInputValue(fill);
  if (!normalized) return;
  const def = getDefaultTypeStyle(typeKey);
  userPointStyles[typeKey] = {
    fill: normalized,
    stroke: def.stroke,
  };
  saveUserColors();
  syncColorInputs();
  if (typeof window.fillLayerIcons === "function") window.fillLayerIcons();
  refreshMonumentSymbology();
  if (closePicker) closeColorPicker();
}

function resetUserColors() {
  userPointStyles = {};
  filterHighlightColor = DEFAULT_FILTER_HIGHLIGHT;
  try {
    localStorage.removeItem(USER_COLORS_STORAGE_KEY);
    localStorage.removeItem(FILTER_HIGHLIGHT_STORAGE_KEY);
    localStorage.removeItem("tkkSymbolizeBy");
  } catch (_) {
    /* ignore */
  }
  closeColorPicker();
  applyFilterHighlightCssVars(filterHighlightColor);
  syncColorInputs();
  syncFilterHighlightInput();
  if (typeof window.fillLayerIcons === "function") window.fillLayerIcons();
  refreshMonumentSymbology();
}

function updateSwatchButton(typeKey, hex) {
  const btn = document.getElementById("symSwatch_" + typeKey);
  if (btn) btn.style.setProperty("--swatch-color", hex);
}

function syncFilterHighlightInput() {
  const val = getFilterHighlightColor();
  updateSwatchButton(FILTER_HIGHLIGHT_KEY, val);
  const hexInput = document.getElementById("symHex_filterHighlight");
  if (hexInput) {
    hexInput.value = val;
    hexInput.classList.remove("symbology-hex-input--invalid");
  }
  const popover = document.getElementById("symPopover_filterHighlight");
  const popHex = popover?.querySelector(".symbology-picker-hex");
  if (popHex && openPickerType === FILTER_HIGHLIGHT_KEY) popHex.value = val;
}

function getPickerColorValue(typeKey) {
  if (typeKey === FILTER_HIGHLIGHT_KEY) return getFilterHighlightColor();
  return (
    normalizeColorInputValue(getTypePointStyle(typeKey).fill) ||
    getDefaultTypeStyle(typeKey).fill
  );
}

function applyPickerColor(typeKey, hex, closePicker) {
  if (typeKey === FILTER_HIGHLIGHT_KEY) {
    setFilterHighlightColor(hex, closePicker);
    return;
  }
  setUserTypeColor(typeKey, hex, closePicker);
}

function syncColorInputs() {
  HERITAGE_TYPES.forEach((typeKey) => {
    const hexInput = document.getElementById("symHex_" + typeKey);
    const s = getTypePointStyle(typeKey);
    const val = normalizeColorInputValue(s.fill) || getDefaultTypeStyle(typeKey).fill;
    updateSwatchButton(typeKey, val);
    if (hexInput) {
      hexInput.value = val;
      hexInput.classList.remove("symbology-hex-input--invalid");
    }
    const popover = document.getElementById("symPopover_" + typeKey);
    const popHex = popover?.querySelector(".symbology-picker-hex");
    if (popHex && openPickerType === typeKey) popHex.value = val;
  });
  syncFilterHighlightInput();
}

function getPickerElements(typeKey) {
  return {
    btn: document.getElementById("symSwatch_" + typeKey),
    popover: document.getElementById("symPopover_" + typeKey),
    popHex: document.querySelector(
      "#symPopover_" + typeKey + " .symbology-picker-hex"
    ),
    presets: document.querySelector(
      "#symPopover_" + typeKey + " .symbology-picker-presets"
    ),
  };
}

function closeColorPicker() {
  if (!openPickerType) return;
  const { btn, popover } = getPickerElements(openPickerType);
  if (popover) popover.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
  openPickerType = null;
}

function openColorPicker(typeKey) {
  if (openPickerType === typeKey) {
    closeColorPicker();
    return;
  }
  closeColorPicker();
  const { btn, popover, popHex } = getPickerElements(typeKey);
  if (!popover || !btn) return;
  const val = getPickerColorValue(typeKey);
  if (popHex) {
    popHex.value = val;
    popHex.classList.remove("symbology-hex-input--invalid");
  }
  popover.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  openPickerType = typeKey;
  popHex?.focus();
}

function fillPresetGrid(container, typeKey) {
  if (!container || container.dataset.filled === "1") return;
  container.dataset.filled = "1";
  container.innerHTML = "";
  COLOR_PRESETS.forEach((hex) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "symbology-preset-btn";
    b.style.background = hex;
    b.title = hex;
    b.setAttribute("aria-label", hex);
    b.addEventListener("click", () => {
      applyPickerColor(typeKey, hex, true);
    });
    container.appendChild(b);
  });
}

function bindHexInput(typeKey, hexInput) {
  hexInput.addEventListener("input", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) {
      hexInput.classList.remove("symbology-hex-input--invalid");
      applyPickerColor(typeKey, parsed, false);
    } else {
      hexInput.classList.add("symbology-hex-input--invalid");
    }
  });

  hexInput.addEventListener("change", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) applyPickerColor(typeKey, parsed, false);
    else {
      hexInput.classList.add("symbology-hex-input--invalid");
      syncColorInputs();
    }
  });

  hexInput.addEventListener("blur", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) applyPickerColor(typeKey, parsed, false);
    else syncColorInputs();
  });
}

function bindPopoverHex(typeKey, popHex) {
  popHex.addEventListener("input", () => {
    const parsed = normalizeColorInputValue(popHex.value);
    const rowHex = document.getElementById("symHex_" + typeKey);
    if (parsed) {
      popHex.classList.remove("symbology-hex-input--invalid");
      if (rowHex) {
        rowHex.value = parsed;
        rowHex.classList.remove("symbology-hex-input--invalid");
      }
      applyPickerColor(typeKey, parsed, false);
    } else {
      popHex.classList.add("symbology-hex-input--invalid");
    }
  });

  popHex.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeColorPicker();
    }
  });
}

function applyMarkerSymbology(marker, feature, typeKey) {
  if (!marker || !feature) return;
  const style = getStyleForFeature(feature, typeKey);
  marker._tkkSymbolStyle = style;
  if (typeof createMonumentIcon === "function") {
    marker.setIcon(createMonumentIcon(typeKey, style));
  }
}

function refreshMonumentSymbology() {
  const registry = window.monumentRegistry || [];
  registry.forEach(({ layer, feature, cluster }) => {
    const typeKey =
      layer?._tkkType ||
      feature?.properties?.lloji ||
      feature?.properties?.LLOJI ||
      "arkeologjike";
    applyMarkerSymbology(layer, feature, typeKey);
    if (typeof setMarkerVisible === "function" && cluster) {
      const hidden = layer._tkkHidden;
      if (!hidden && !cluster.hasLayer(layer)) {
        cluster.addLayer(layer);
      }
    }
  });

  if (typeof refreshAllClusters === "function") {
    refreshAllClusters();
  }

  if (typeof window.refreshSelectedMonumentMarker === "function") {
    window.refreshSelectedMonumentMarker();
  }
}

function initSymbologyUser() {
  loadUserColors();

  if (!symbologyInitialized) {
    HERITAGE_TYPES.forEach((typeKey) => {
      const { btn, popover, popHex, presets } = getPickerElements(typeKey);
      const rowHex = document.getElementById("symHex_" + typeKey);

      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          openColorPicker(typeKey);
        });
      }

      if (presets) fillPresetGrid(presets, typeKey);
      if (popHex) bindPopoverHex(typeKey, popHex);
      if (rowHex) bindHexInput(typeKey, rowHex);

      if (popover) {
        popover.addEventListener("click", (e) => e.stopPropagation());
      }
    });

    document.addEventListener("click", () => closeColorPicker());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeColorPicker();
    });

    const resetBtn = document.getElementById("symbologyResetBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetUserColors);

    const fhBtn = document.getElementById("symSwatch_filterHighlight");
    const fhPopover = document.getElementById("symPopover_filterHighlight");
    const fhHex = document.getElementById("symHex_filterHighlight");
    const fhPresets = fhPopover?.querySelector(".symbology-picker-presets");
    const fhPopHex = fhPopover?.querySelector(".symbology-picker-hex");

    if (fhBtn) {
      fhBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openColorPicker(FILTER_HIGHLIGHT_KEY);
      });
    }
    if (fhPresets) fillPresetGrid(fhPresets, FILTER_HIGHLIGHT_KEY);
    if (fhPopHex) bindPopoverHex(FILTER_HIGHLIGHT_KEY, fhPopHex);
    if (fhHex) bindHexInput(FILTER_HIGHLIGHT_KEY, fhHex);
    if (fhPopover) {
      fhPopover.addEventListener("click", (e) => e.stopPropagation());
    }
  }

  symbologyInitialized = true;
  syncColorInputs();

  if ((window.monumentRegistry || []).length) {
    refreshMonumentSymbology();
  }
}

window.getTypePointStyle = getTypePointStyle;
window.getFilterHighlightColor = getFilterHighlightColor;
window.setFilterHighlightColor = setFilterHighlightColor;
window.getStyleForFeature = getStyleForFeature;
window.refreshMonumentSymbology = refreshMonumentSymbology;
window.initSymbologyUser = initSymbologyUser;
window.resetUserColors = resetUserColors;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSymbologyUser);
} else {
  initSymbologyUser();
}
