/**
 * Ngjyra të personalizuara për 3 llojet e monumenteve
 */

const USER_COLORS_STORAGE_KEY = "tkkUserPointStyles";
const HERITAGE_TYPES = ["arkeologjike", "arkitekturore", "luajtshme"];

const COLOR_PRESETS = [
  "#f97316",
  "#ea580c",
  "#b45309",
  "#dc2626",
  "#2dd4bf",
  "#0d9488",
  "#14b8a6",
  "#38bdf8",
  "#a3e635",
  "#65a30d",
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
  try {
    const raw = localStorage.getItem(USER_COLORS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      userPointStyles = parsed;
    }
  } catch (_) {
    userPointStyles = {};
  }
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

function getSymbolizeBy() {
  return "lloji";
}

function getStyleForFeature(_feature, typeKey) {
  const key = typeKey || "arkeologjike";
  const s = getTypePointStyle(key);
  return { fill: s.fill, stroke: s.stroke, key, mode: "lloji" };
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
  try {
    localStorage.removeItem(USER_COLORS_STORAGE_KEY);
    localStorage.removeItem("tkkSymbolizeBy");
  } catch (_) {
    /* ignore */
  }
  closeColorPicker();
  syncColorInputs();
  if (typeof window.fillLayerIcons === "function") window.fillLayerIcons();
  refreshMonumentSymbology();
}

function updateSwatchButton(typeKey, hex) {
  const btn = document.getElementById("symSwatch_" + typeKey);
  if (btn) btn.style.setProperty("--swatch-color", hex);
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
  const val =
    normalizeColorInputValue(getTypePointStyle(typeKey).fill) ||
    getDefaultTypeStyle(typeKey).fill;
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
      setUserTypeColor(typeKey, hex, true);
    });
    container.appendChild(b);
  });
}

function bindHexInput(typeKey, hexInput) {
  hexInput.addEventListener("input", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) {
      hexInput.classList.remove("symbology-hex-input--invalid");
      setUserTypeColor(typeKey, parsed, false);
    } else {
      hexInput.classList.add("symbology-hex-input--invalid");
    }
  });

  hexInput.addEventListener("change", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) setUserTypeColor(typeKey, parsed, false);
    else {
      hexInput.classList.add("symbology-hex-input--invalid");
      syncColorInputs();
    }
  });

  hexInput.addEventListener("blur", () => {
    const parsed = normalizeColorInputValue(hexInput.value);
    if (parsed) setUserTypeColor(typeKey, parsed, false);
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
      setUserTypeColor(typeKey, parsed, false);
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
  }

  symbologyInitialized = true;
  syncColorInputs();

  if ((window.monumentRegistry || []).length) {
    refreshMonumentSymbology();
  }
}

window.getTypePointStyle = getTypePointStyle;
window.getSymbolizeBy = getSymbolizeBy;
window.getStyleForFeature = getStyleForFeature;
window.refreshMonumentSymbology = refreshMonumentSymbology;
window.initSymbologyUser = initSymbologyUser;
window.resetUserColors = resetUserColors;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSymbologyUser);
} else {
  initSymbologyUser();
}
