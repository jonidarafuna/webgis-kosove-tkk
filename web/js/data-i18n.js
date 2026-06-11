/**
 * SKEDARI: data-i18n.js
 * QËLLIMI: Përkthe vlerat e të dhënave (komuna, kategoria, periudha) për UI anglisht.
 * KUR NGARKOHET: Pas monument-name-en.js, para settings.js (index.html).
 * LIDHET ME: monument-name-en.js, i18n.js (getLang), chart.js (translateDataValue),
 *            filters.js (getFilteredFeatures), detail.js, sidebar.js (refresh*I18n).
 *
 * Përkthim i të dhënave nga CSV/WFS për UI anglisht — skedarët burimorë nuk ndryshohen.
 */

// Harta e përkthimeve të ngarkuar nga display-en.json (ose embedded)
let displayEnMap = null;
let displayEnLoadPromise = null;

// Përkthime të integruara — përdoren nëse JSON nuk ngarkohet
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
    fortifikim_kala: "Fortification / castle",
    "fortifikim/kala": "Fortification / castle",
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

/** Normalizon një vlerë teksti për kërkim në tabelë (pa theks, lowercase). */
function normalizeDataKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Kërkon përkthimin e një vlerë në tabelën e dhënë. */
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

/** Ngarkon display-en.json dhe bashkon me përkthimet e integruara. */
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

/** Etiketa shqip/en për kategoritë e monumenteve (çelës i unifikuar). */
const KATEGORIA_CANONICAL = {
  vendbanim: { sq: "Vendbanim", en: "Settlement" },
  nekropoli: { sq: "Nekropoli", en: "Necropolis" },
  fortifikate_kalaje: { sq: "Fortifikim / kala", en: "Fortification / castle" },
  gjurme_rrnoje: { sq: "Gjurmë rrënojë", en: "Settlement traces" },
  kulla: { sq: "Kulla", en: "Tower" },
  monument: { sq: "Monument", en: "Monument" },
  monument_arkitekture: { sq: "Monument arkitekture", en: "Architectural monument" },
  objekt_fetar: { sq: "Objekt fetar", en: "Religious building" },
  objekt_luajtshme: { sq: "Objekt i luajtshëm", en: "Movable heritage object" },
  objekt_urban: { sq: "Objekt urban", en: "Urban heritage object" },
  ure: { sq: "Urë", en: "Bridge" },
  lokalitet: { sq: "Lokalitet", en: "Site" },
  muze: { sq: "Muze", en: "Museum" },
  biblioteka: { sq: "Bibliotekë", en: "Library" },
  arkitekturore: { sq: "Arkitekturore", en: "Architectural" },
};

/** Alias → çelës kanonik (p.sh. fortifikim/kala nga CSV i ri). */
const KATEGORIA_ALIASES = {
  fortifikim_kala: "fortifikate_kalaje",
  "fortifikim/kala": "fortifikate_kalaje",
  fortifikimkala: "fortifikate_kalaje",
  fortifikatekalaje: "fortifikate_kalaje",
};

/** Normalizon vlerën e kategorisë për krahasim filtrash. */
function normalizeKategoriaKey(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\//g, "_")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

  if (KATEGORIA_ALIASES[s]) return KATEGORIA_ALIASES[s];
  if (KATEGORIA_CANONICAL[s]) return s;
  return s;
}

/** Etiketë e lexueshme për kategori (shqip ose anglisht). */
function getKategoriaLabel(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—") return "—";

  const key = normalizeKategoriaKey(s);
  const entry = KATEGORIA_CANONICAL[key];
  if (entry) {
    return typeof getLang === "function" && getLang() === "en"
      ? entry.en
      : entry.sq;
  }

  if (typeof getLang === "function" && getLang() === "en") {
    const hit = lookupInTable(displayEnMap?.kategoria, s);
    if (hit) return hit;
    return translateKategoriaFallback(s);
  }

  if (s.includes("_") || s.includes("/")) {
    return s
      .replace(/\//g, " / ")
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Përkthe emrin e kategorisë kur mungon në tabelë (snake_case → Title Case). */
function translateKategoriaFallback(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "—") return s;
  if (!s.includes("_") && !s.includes("/")) return s;
  return s
    .replace(/\//g, " / ")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Përkthe periudhën historike për shfaqje nga properties. */
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
  if (field === "kategoria") return getKategoriaLabel(raw);

  if (typeof getLang !== "function" || getLang() !== "en") {
    return rawValue == null ? "—" : String(rawValue).trim();
  }

  if (!displayEnMap) return rawValue == null ? "—" : String(rawValue).trim();

  if (field === "periudha" || field === "periudha_detaj") {
    return translatePeriudhaDisplay(props || { periudha_detaj: raw, periudha: raw });
  }

  const table = displayEnMap[field];
  const hit = lookupInTable(table, raw);
  if (hit) return hit;

  return raw;
}

/** Përkthe të gjitha fushat e një monumenti për panelin e detajeve. */
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

/** Rifreskon grafikët, detajet dhe kërkimin pas ndryshimit të gjuhës. */
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
  if (typeof buildMonumentFilterOptions === "function") {
    buildMonumentFilterOptions();
  }
  if (typeof updateActivePeriodChips === "function") {
    updateActivePeriodChips();
  }
}

// Ngarkon hartën e përkthimeve menjëherë kur ekzekutohet skedari
loadDisplayEnMap();

// Rifreskon shfaqjet kur përdoruesi ndryshon gjuhën
window.addEventListener("tkk:lang-change", () => {
  refreshDataDisplays();
});

window.loadDisplayEnMap = loadDisplayEnMap;
/** Kthen emrin e shfaqur të monumentit (me përkthim nëse gjuha është EN). */
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
window.getKategoriaLabel = getKategoriaLabel;
window.normalizeKategoriaKey = normalizeKategoriaKey;
window.td = translateDataValue;
