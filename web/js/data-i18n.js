/**
 * Përkthim i të dhënave nga CSV/WFS për UI anglisht — skedarët burimorë nuk ndryshohen.
 */

let displayEnMap = null;
let displayEnLoadPromise = null;

const DATA_I18N_EMBEDDED = {
  gjendja: {
    "e mire": "Good condition",
    "e mirë": "Good condition",
    "e demtuar": "Damaged",
    "e dëmtuar": "Damaged",
    "e panjohur": "Unknown",
    "e përafërt": "Approximate",
    "e pa përcaktuar": "Not determined",
  },
  kategoria: {
    fortifikate_kalaje: "Fortification / castle",
    gjurme_rrnoje: "Settlement traces",
    kulla: "Tower",
    monument: "Monument",
    monument_arkitekture: "Architectural monument",
    nekropoli: "Necropolis",
    objekt_fetar: "Religious building",
    objekt_luajtshme: "Movable heritage object",
    objekt_urban: "Urban heritage object",
    ure: "Bridge",
    vendbanim: "Settlement",
  },
  komuna: {
    "Fushë Kosovë": "Kosovo Polje",
    Gjakovë: "Gjakova",
    Graçanicë: "Gračanica",
    "Hani I Elezit": "Elez Han",
    Kamenicë: "Kamenica",
    Kaçanik: "Kaçanik",
    Klinë: "Klina",
    Malishevë: "Mališevo",
    Mitrovicë: "Mitrovica",
    "Novo Bërdë": "Novo Brdo",
    Partesh: "Parteš",
    Pejë: "Peja",
    Podujevë: "Podujeva",
    Prishtinë: "Pristina",
    Shtime: "Štimlje",
    Suharekë: "Suva Reka",
    Viti: "Vitina",
    Zveçan: "Zvečan",
    Kosovë: "Kosovo",
    "N.A.": "N/A",
  },
  rajon: {
    Kosovë: "Kosovo",
    Prishtinë: "Pristina",
    Prishtinës: "Pristina",
    Pejë: "Peja",
    Prizren: "Prizren",
    Prizrenit: "Prizren",
    Mitrovicë: "Mitrovica",
    Mitrovicës: "Mitrovica",
    Gjilan: "Gjilan",
    Gjilanit: "Gjilan",
    Ferizaj: "Ferizaj",
    Ferizajit: "Ferizaj",
    Gjakovë: "Gjakova",
    Gjakovës: "Gjakova",
  },
  periudha_detaj: {
    Paleolit: "Paleolithic",
    Neolit: "Neolithic",
    Eneolit: "Eneolithic",
    "Epoka e Bronzit": "Bronze Age",
    "Epoka e Hekurit": "Iron Age",
    Romake: "Roman",
    "Antikiteti i Vonë": "Late antiquity",
    "Mesjetë e Hershme": "Early Middle Ages",
    "Mesjetë e Vonë": "Late Middle Ages",
    Osmane: "Ottoman",
    Moderne: "Modern",
  },
  burimi: { DTK: "DTK" },
};

function normalizeDataKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function lookupInTable(table, raw) {
  if (!table || raw == null || raw === "" || raw === "—") return null;
  const s = String(raw).trim();
  if (table[s] != null) return table[s];

  const norm = normalizeDataKey(s);
  for (const [k, v] of Object.entries(table)) {
    if (normalizeDataKey(k) === norm) return v;
  }
  return null;
}

function loadDisplayEnMap() {
  if (displayEnLoadPromise) return displayEnLoadPromise;
  const base =
    typeof window.tkkAppBase === "function" ? window.tkkAppBase() : "";
  displayEnLoadPromise = fetch(base + "data/display-en.json")
    .then((r) => (r.ok ? r.json() : DATA_I18N_EMBEDDED))
    .then((data) => {
      displayEnMap = {
        gjendja: { ...DATA_I18N_EMBEDDED.gjendja, ...(data.gjendja || {}) },
        kategoria: { ...DATA_I18N_EMBEDDED.kategoria, ...(data.kategoria || {}) },
        komuna: { ...DATA_I18N_EMBEDDED.komuna, ...(data.komuna || {}) },
        rajon: { ...DATA_I18N_EMBEDDED.rajon, ...(data.rajon || {}) },
        periudha_detaj: {
          ...DATA_I18N_EMBEDDED.periudha_detaj,
          ...(data.periudha_detaj || {}),
        },
        burimi: { ...DATA_I18N_EMBEDDED.burimi, ...(data.burimi || {}) },
        status_mbrojtjes: data.status_mbrojtjes || {},
        monuments: data.monuments || {},
      };
      return displayEnMap;
    })
    .catch(() => {
      displayEnMap = {
        ...DATA_I18N_EMBEDDED,
        status_mbrojtjes: {},
        monuments: {},
      };
      return displayEnMap;
    });
  return displayEnLoadPromise;
}

/**
 * Emri i rajonit për shfaqje (WFS: "Rajoni i Prishtinës", CSV: "Kosovë", …).
 */
function translateRajonDisplayName(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s || s === "—") return s;
  if (typeof getLang !== "function" || getLang() !== "en") return s;
  if (!displayEnMap?.rajon) return s;

  const full = lookupInTable(displayEnMap.rajon, s);
  if (full) return full;

  const prefixed = s.match(/^rajoni i\s+(.+)$/i);
  if (prefixed) {
    const core = prefixed[1].trim();
    const coreHit = lookupInTable(displayEnMap.rajon, core);
    if (coreHit) {
      if (/region$/i.test(coreHit) || coreHit === "Kosovo") return coreHit;
      return "Region of " + coreHit;
    }
    if (/^kosov/i.test(core)) return "Kosovo";
    return "Region of " + core;
  }

  const hit = lookupInTable(displayEnMap.rajon, s);
  if (hit) return hit;
  if (/^kosov/i.test(s)) return "Kosovo";
  return s;
}

function translateKategoriaFallback(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—") return s;
  if (!s.includes("_")) return s;
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function translatePeriudhaDisplay(props) {
  const p = props || {};
  const detaj =
    p.periudha_detaj ?? p.PERIUDHA_DETAJ ?? p.periudha ?? p.PERIUDHA ?? "";
  const detajStr = String(detaj).trim();
  if (!detajStr || detajStr === "—") {
    if (typeof getPeriodLabel === "function" && typeof normalizePeriudha === "function") {
      return getPeriodLabel(normalizePeriudha(p));
    }
    return "—";
  }

  if (typeof getLang === "function" && getLang() !== "en") {
    return detajStr;
  }

  const mapped = lookupInTable(displayEnMap?.periudha_detaj, detajStr);
  if (mapped) return mapped;

  if (typeof normalizePeriudha === "function" && typeof getPeriodLabel === "function") {
    const key = normalizePeriudha(p);
    const fromKey = getPeriodLabel(key);
    if (fromKey && fromKey !== key && fromKey !== "period." + key) {
      return fromKey;
    }
  }

  return detajStr;
}

/**
 * Përkthe vlerën e një fushe CSV për shfaqje (jo për filtrim).
 * @param {string} field — gjendja | kategoria | komuna | rajon | burimi | …
 * @param {*} rawValue
 * @param {object} [props] — properties e plotë (për periudhën)
 */
function translateDataValue(field, rawValue, props) {
  const raw = rawValue == null || rawValue === "" ? "—" : String(rawValue).trim();
  if (raw === "—") return "—";
  if (field === "emri") {
    return typeof translateMonumentDisplayName === "function"
      ? translateMonumentDisplayName(raw, props)
      : raw;
  }
  if (field === "rajon") return translateRajonDisplayName(raw);
  if (typeof getLang !== "function" || getLang() !== "en") return rawValue == null ? "—" : String(rawValue).trim();

  if (!displayEnMap) return rawValue == null ? "—" : String(rawValue).trim();

  if (field === "periudha" || field === "periudha_detaj") {
    return translatePeriudhaDisplay(props || { periudha_detaj: raw, periudha: raw });
  }

  const table = displayEnMap[field];
  const hit = lookupInTable(table, raw);
  if (hit) return hit;

  if (field === "kategoria") {
    return translateKategoriaFallback(raw);
  }

  return raw;
}

function translatePropsForDisplay(props) {
  const p = props || {};
  const pick = (key) => p[key] ?? p[key.toUpperCase()] ?? "—";
  return {
    emri: translateDataValue("emri", pick("emri"), p),
    komuna: translateDataValue("komuna", pick("komuna"), p),
    rajon: translateRajonDisplayName(pick("rajon") || pick("Rajoni")),
    kategoria: translateDataValue("kategoria", pick("kategoria"), p),
    gjendja: translateDataValue("gjendja", pick("gjendja"), p),
    burimi: translateDataValue("burimi", pick("burimi"), p),
    periudha: translatePeriudhaDisplay(p),
    lloji: typeof getHeritageTypeLabel === "function"
      ? getHeritageTypeLabel(p.lloji_trashegimise || p.LLOJI_TRASHEGIMISE)
      : pick("lloji_trashegimise"),
  };
}

function refreshDataDisplays() {
  if (typeof refreshRajonetLabelsI18n === "function") {
    refreshRajonetLabelsI18n();
  }
  if (typeof refreshDetailPanelI18n === "function") {
    refreshDetailPanelI18n();
  }
  if (typeof refreshSearchI18n === "function") {
    refreshSearchI18n();
  }
  if (typeof refreshMonumentPickerI18n === "function") {
    refreshMonumentPickerI18n();
  }
  const features =
    typeof getFilteredFeatures === "function"
      ? getFilteredFeatures()
      : window.allMonumentFeatures;
  if (typeof updatePeriudhaChart === "function" && features) {
    updatePeriudhaChart(features);
  }
  if (typeof updateGeoChart === "function" && features) {
    updateGeoChart(features);
  }
}

loadDisplayEnMap();

window.addEventListener("tkk:lang-change", () => {
  refreshDataDisplays();
});

window.loadDisplayEnMap = loadDisplayEnMap;
function getMonumentDisplayName(props) {
  const p = props || {};
  const raw = (p.emri ?? p.EMRI ?? "").trim();
  if (!raw) return "—";
  return translateDataValue("emri", raw, p);
}

window.getMonumentDisplayName = getMonumentDisplayName;
window.translateRajonDisplayName = translateRajonDisplayName;
window.translateDataValue = translateDataValue;
window.translatePropsForDisplay = translatePropsForDisplay;
window.translatePeriudhaDisplay = translatePeriudhaDisplay;
window.refreshDataDisplays = refreshDataDisplays;
window.td = translateDataValue;
