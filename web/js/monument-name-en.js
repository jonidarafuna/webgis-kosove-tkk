/**
 * Emra monumentesh në anglisht — vetëm formula të qarta (Kulla e X → Tower of X).
 * Emrat propri / toponimet mbeten; pa përkthim → mbetet shqip.
 */

const MONUMENT_TITLE_SMALL = new Set([
  "of",
  "the",
  "and",
  "in",
  "at",
  "to",
  "–",
  "-",
]);

/** Objekte të luajtshme — përputhje e plotë (pas normalizimit). */
const MOVABLE_HERITAGE_EN = {
  arkë: "Chest",
  cerep: "Bread oven (çerep)",
  cigarellëk: "Pipe (cigarellëk)",
  "djep foshnjash": "Infant cradle",
  furkë: "Wooden distaff",
  "ibrik druri": "Wooden ewer",
  "kemishe burri": "Men's shirt",
  "kemishe femrash": "Women's shirt",
  "knatë (testi)": "Water jug (knate)",
  knate: "Water jug (knate)",
  legen: "Wash basin",
  marhamë: "Scarf (marhamë)",
  opingat: "Leather sandals (opinga)",
  plisi: "Felt cap (plis)",
  qilim: "Rug (qilim)",
  "rozetë tavani (tavanishte)": "Ceiling rosette (tavanishte)",
  "rreth i fëmijëve": "Child's wooden ring",
  shkam: "Wooden stool",
  "shokë burri": "Men's socks (folk)",
  "shportë për mbajtjen e lugëve": "Spoon basket",
  "tabak i kafesë": "Coffee tray",
  tavolinë: "Table",
  vegsh: "Cooking pot",
  xhubleta: "Xhubleta (folk garment)",
  "mbajtëse gotash (ferash)": "Cup holder (ferash)",
  "veshje popullore burri": "Men's folk costume",
  "veshje popullore gruaje": "Women's folk costume",
};

function monumentNormalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function fixMonumentEnglishTitle(s) {
  return s
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && MONUMENT_TITLE_SMALL.has(w.toLowerCase())) return w.toLowerCase();
      if (/^[A-Z]{2,}$/.test(w) && w.length <= 5) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function normalizeMonumentInput(raw) {
  let s = String(raw).trim().replace(/\s+/g, " ");
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length > 5 && letters === letters.toUpperCase()) {
    s = s
      .toLowerCase()
      .replace(/(^|[\s(])([\p{L}])/gu, (_, pre, ch) => pre + ch.toUpperCase());
  }
  return s;
}

function translateMonumentSubtitle(part) {
  const p = String(part).trim();
  const rules = [
    [/^shkolla e parë shqipe$/i, "First Albanian school"],
    [/^shkolla e pare shqipe$/i, "First Albanian school"],
  ];
  for (const [re, repl] of rules) {
    if (re.test(p)) return repl;
  }
  return p;
}

function applyMonumentRule(s, re, build) {
  const m = s.match(re);
  if (!m) return null;
  const out = typeof build === "function" ? build(m) : build;
  return fixMonumentEnglishTitle(out);
}

function translateMonumentByPattern(s) {
  const rules = [
    [
      /^tëresia urbanistike\s+(.+)$/i,
      (m) => `Urban ensemble: ${m[1]}`,
    ],
    [
      /^lokaliteti antik arkeologjik i\s+(.+)$/i,
      (m) => `Ancient archaeological site of ${m[1]}`,
    ],
    [
      /^lokaliteti arkeologjik në\s+(.+)$/i,
      (m) => `Archaeological site at ${m[1]}`,
    ],
    [
      /^lokaliteti arkeologjik[-–]\s*(.+)$/i,
      (m) => `Archaeological site – ${m[1]}`,
    ],
    [
      /^lokaliteti arkeologjik\s+(.+)$/i,
      (m) => `Archaeological site – ${m[1]}`,
    ],
    [
      /^lokaliteti arkeologjik\s+['"](.+?)['"]\s*[-–]\s*(.+)$/i,
      (m) => `Archaeological site “${m[1]}” – ${m[2]}`,
    ],
    [
      /^fortesa parahistorike e\s+(.+?)\s*\(([^)]+)\)$/i,
      (m) => `Prehistoric fortress of ${m[1]} (${m[2]})`,
    ],
    [
      /^fortesa parahistorike e\s+(.+)$/i,
      (m) => `Prehistoric fortress of ${m[1]}`,
    ],
    [
      /^gërmadhat e objektit fetar\s+(.+)$/i,
      (m) => `Ruins of ${m[1]} (religious site)`,
    ],
    [
      /^gërmadhat e\s+(.+)$/i,
      (m) => `Ruins of ${m[1]}`,
    ],
    [
      /^shtëpia tradicionale e\s+(.+)$/i,
      (m) => `Traditional house of ${m[1]}`,
    ],
    [
      /^shtëpia e\s+(.+)$/i,
      (m) => `House of ${m[1]}`,
    ],
    [
      /^kulla e\s+(.+?)\s*\(\s*teqja e\s+(.+?)\s*\)$/i,
      (m) => `Tower of ${m[1]} (Tekke of ${m[2]})`,
    ],
    [
      /^kulla e\s+(.+)$/i,
      (m) => `Tower of ${m[1]}`,
    ],
    [
      /^xhamia e fshatit\s+(.+)$/i,
      (m) => `Mosque of ${m[1]} village`,
    ],
    [
      /^xhamia e\s+(.+)$/i,
      (m) => `Mosque of ${m[1]}`,
    ],
    [
      /^ura e\s+(.+)$/i,
      (m) => `Bridge of ${m[1]}`,
    ],
    [
      /^çarshia e\s+(.+)$/i,
      (m) => `Bazaar of ${m[1]}`,
    ],
    [
      /^mulliri i fshatit\s+(.+)$/i,
      (m) => `Mill of ${m[1]} village`,
    ],
    [
      /^mulliri i\s+(.+)$/i,
      (m) => `Mill of ${m[1]}`,
    ],
    [
      /^muzeu\s+(.+)$/i,
      (m) => `${m[1]} Museum`,
    ],
    [
      /^medresa e madhe$/i,
      () => "Great Madrasa",
    ],
    [
      /^medresa e\s+(.+)$/i,
      (m) => `Madrasa of ${m[1]}`,
    ],
    [
      /^mejtepi\s+(.+?)\s*[-–]\s*(.+)$/i,
      (m) => `Madrasa ${m[1]} – ${translateMonumentSubtitle(m[2])}`,
    ],
    [
      /^mejtepi i\s+(.+)$/i,
      (m) => `Madrasa of ${m[1]}`,
    ],
    [
      /^hani i\s+(.+)$/i,
      (m) => `${m[1]} Inn`,
    ],
    [
      /^kisha paleokristiane në\s+(.+)$/i,
      (m) => `Early Christian church at ${m[1]}`,
    ],
    [
      /^kisha katolike e\s+(.+?)\s*\(([^)]+)\)$/i,
      (m) => `Catholic Church of ${m[1]} (${m[2]})`,
    ],
    [
      /^kisha e\s+(.+)$/i,
      (m) => `Church of ${m[1]}`,
    ],
    [
      /^teqeja e\s+(.+)$/i,
      (m) => `Tekke of ${m[1]}`,
    ],
    [
      /^kalaja e antikitetit të vonë në\s+(.+)$/i,
      (m) => `Late antique castle at ${m[1]}`,
    ],
    [
      /^kalaja e\s+(.+)$/i,
      (m) => `Castle of ${m[1]}`,
    ],
    [
      /^nekropolë mesjetare në\s+(.+)$/i,
      (m) => `Medieval necropolis at ${m[1]}`,
    ],
    [
      /^nekropoli tumular ilir i\s+(.+)$/i,
      (m) => `Illyrian tumulus necropolis of ${m[1]}`,
    ],
    [
      /^nekropoli tumular i\s+(.+)$/i,
      (m) => `Tumulus necropolis of ${m[1]}`,
    ],
    [
      /^nekropoli i tumulave të\s+(.+)$/i,
      (m) => `Tumulus necropolis of ${m[1]}`,
    ],
    [
      /^nekropoli\s+(.+)$/i,
      (m) => `Necropolis of ${m[1]}`,
    ],
    [
      /^nekropolë\s+(.+)$/i,
      (m) => `Necropolis of ${m[1]}`,
    ],
    [
      /^hamami\s+(.+)$/i,
      (m) => `Hammam of ${m[1]}`,
    ],
    [
      /^manastiri i\s+(.+)$/i,
      (m) => `Monastery of ${m[1]}`,
    ],
    [
      /^tuma ilire te\s+(.+?)\s*[-–]\s*(.+)$/i,
      (m) => `Illyrian tumulus at ${m[1]} – ${m[2]}`,
    ],
    [
      /^tumat ilire në\s+(.+)$/i,
      (m) => `Illyrian tumuli at ${m[1]}`,
    ],
    [
      /^objekti i\s+(.+)$/i,
      (m) => m[1],
    ],
    [
      /^lokaliteti arkeologjik-fortifikata\s+(.+)$/i,
      (m) => `Archaeological site – ${m[1]}`,
    ],
    [
      /^gjyteti i madh dhe gjyteti i vogël në\s+(.+)$/i,
      (m) => `Large and small hillfort at ${m[1]}`,
    ],
    [
      /^valanicë\s*[-–]\s*mulli$/i,
      () => "Valanica – mill",
    ],
    [
      /^tabhanja$/i,
      () => "Tabhane (tanners' quarter)",
    ],
  ];

  for (const [re, build] of rules) {
    const hit = applyMonumentRule(s, re, build);
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {string} raw
 * @param {object} [props]
 */
function translateMonumentDisplayName(raw, props) {
  const original = raw == null || raw === "" ? "—" : String(raw).trim();
  if (original === "—") return "—";
  if (typeof getLang !== "function" || getLang() !== "en") return original;

  const id = String(props?.id ?? props?.ID ?? "").trim();
  if (
    id &&
    typeof displayEnMap !== "undefined" &&
    displayEnMap?.monuments?.[id]
  ) {
    return displayEnMap.monuments[id];
  }

  const normalized = normalizeMonumentInput(original);
  const dictKey = monumentNormalizeKey(normalized);
  if (MOVABLE_HERITAGE_EN[dictKey]) {
    return MOVABLE_HERITAGE_EN[dictKey];
  }

  if (/^(municipium|ulpiana|justiniana)/i.test(normalized)) {
    return fixMonumentEnglishTitle(normalized);
  }

  const fromPattern = translateMonumentByPattern(normalized);
  if (fromPattern) return fromPattern;

  return original;
}

window.translateMonumentDisplayName = translateMonumentDisplayName;
