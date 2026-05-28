/** GitHub Pages / demo statik — pa node serve.js dhe pa GeoServer live */
function tkkDetectStaticPublish() {
  if (typeof window === "undefined") return false;
  if (/\.github\.io$/i.test(window.location.hostname)) return true;
  if (/[?&]static=1\b/.test(window.location.search || "")) return true;
  return false;
}

window.tkkIsStaticPublish = tkkDetectStaticPublish();

/** Bazë e shtesës për GitHub Pages (p.sh. /webgis-kosove-tkk/) */
function tkkAppBase() {
  if (typeof window === "undefined") return "/";
  let p = window.location.pathname || "/";
  if (!p.endsWith("/")) {
    if (/index\.html?$/i.test(p)) p = p.replace(/[^/]+$/, "");
    else p = p.replace(/[^/]*$/, "") || "/";
  }
  return p;
}
window.tkkAppBase = tkkAppBase;

function tkkEncodeUrlPath(url) {
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => (seg ? encodeURIComponent(decodeURIComponent(seg)) : ""))
      .join("/");
    return u.href;
  } catch {
    return url;
  }
}

/** Foto DTK: proxy lokale (serve.js) ose URL direkte në GitHub Pages */
function tkkResolveMediaUrl(path) {
  if (!path) return path;
  const s = String(path).trim();
  if (/^https?:\/\//i.test(s)) {
    const m = s.match(/dtk\.rks-gov\.net\/files(\/.+)/i);
    if (m) {
      if (window.tkkIsStaticPublish) {
        return tkkEncodeUrlPath("https://dtk.rks-gov.net/files" + m[1]);
      }
      return tkkEncodeUrlPath(window.location.origin + "/dtk-files" + m[1]);
    }
    return s;
  }
  if (s.startsWith("/dtk-files")) {
    const rest = s.replace(/^\/dtk-files/, "");
    if (window.tkkIsStaticPublish) {
      return tkkEncodeUrlPath("https://dtk.rks-gov.net/files" + rest);
    }
    return tkkEncodeUrlPath(window.location.origin + s);
  }
  if (s.startsWith("/")) {
    return window.location.origin + tkkAppBase() + s.replace(/^\//, "");
  }
  return tkkAppBase() + s.replace(/^\//, "");
}
window.tkkResolveMediaUrl = tkkResolveMediaUrl;

/** GeoServer — përmes proxy në serve.js (shmang CORS); jo në GitHub Pages */
const GEOSERVER_BASE = window.tkkIsStaticPublish
  ? ""
  : window.location.origin + "/geoserver/tkk";
const WMS_URL = GEOSERVER_BASE ? GEOSERVER_BASE + "/wms" : "";
const WFS_URL = GEOSERVER_BASE ? GEOSERVER_BASE + "/wfs" : "";

const WMS_LAYERS = {
  rajonet: "tkk:Rajonet",
  komunat: "tkk:Komunat",
  kosova: "tkk:Kosova",
};

/** Emra alternativë WFS për rajonet (GeoServer) */
const WFS_LAYER_ALIASES = {
  rajonet: ["tkk:Rajonet", "tkk:rajonet", "Rajonet"],
  komunat: ["tkk:Komunat", "tkk:komunat", "Komunat"],
};

/** Fusha të mundshme për emrin e komunës (WFS) */
const KOMUNA_LABEL_FIELDS = [
  "shapeName",
  "emri",
  "emri_komunes",
  "name",
  "NAME",
  "komuna",
  "KOMUNA",
  "municipality",
];

/** Fusha të mundshme për emrin e rajonit (WFS) */
const RAJON_LABEL_FIELDS = [
  "Rajoni",
  "rajoni",
  "shapeName",
  "emri",
  "name",
  "NAME",
  "region",
];

const WFS_LAYERS = {
  arkeologjike: "tkk:sites_arkeologjike",
  arkitekturore: "tkk:sites_arkitekturore",
  luajtshme: "tkk:sites_luajtshme",
};

/** Paleta Set2 — 3 ngjyra për monumentet (Loading.io / ColorBrewer) */
const MONUMENT_SET2_COLORS = {
  arkeologjike: { fill: "#FC8D62", stroke: "#e07850" },
  arkitekturore: { fill: "#8DA0CB", stroke: "#7589b5" },
  luajtshme: { fill: "#66C2A5", stroke: "#52a88d" },
};

const POINT_STYLES = {
  arkeologjike: {
    fill: MONUMENT_SET2_COLORS.arkeologjike.fill,
    stroke: MONUMENT_SET2_COLORS.arkeologjike.stroke,
    radius: 7,
    label: "Trashëgimia arkeologjike",
  },
  arkitekturore: {
    fill: MONUMENT_SET2_COLORS.arkitekturore.fill,
    stroke: MONUMENT_SET2_COLORS.arkitekturore.stroke,
    radius: 7,
    label: "Trashëgimia arkitekturore",
  },
  luajtshme: {
    fill: MONUMENT_SET2_COLORS.luajtshme.fill,
    stroke: MONUMENT_SET2_COLORS.luajtshme.stroke,
    radius: 7,
    label: "Trashëgimia e luajtshme",
  },
};

/**
 * Ikona të tua (PNG/SVG) — vendos skedarët në web/images/icons/
 * ose ndrysho "file" / "url" më poshtë.
 *
 * Shembull me path absolut (kopjo nga PC-ja jote):
 *   url: "file:///C:/Users/.../ikona-ark.png"  ← MOS përdor file:// në web
 * Më mirë: kopjo skedarët në web/images/icons/
 */
const MONUMENT_ICON_BASE = "images/icons/";

const MONUMENT_ICONS = {
  arkeologjike: {
    file: "arkeologjike.png",
    size: [15, 15],
    hitSize: [30, 30],
    anchor: [15, 30],
  },
  arkitekturore: {
    file: "arkitekturore.png",
    size: [18, 18],
    hitSize: [32, 32],
    anchor: [16, 32],
  },
  luajtshme: {
    file: "luajtshme.png",
    size: [18, 18],
    hitSize: [32, 32],
    anchor: [16, 32],
  },
};

function getMonumentIconUrl(typeKey) {
  const cfg = MONUMENT_ICONS[typeKey];
  if (!cfg) return null;
  if (cfg.url) return cfg.url;
  if (cfg.file) return MONUMENT_ICON_BASE + cfg.file;
  return null;
}

/** CARTO Dark Matter (OSM) — pa etiketa (parazgjedhje / auto) */
const BASEMAP_URL_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
/** CARTO Positron (OSM) — modaliteti i çelët, pa etiketa */
const BASEMAP_URL_LIGHT =
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
/** CARTO — me etiketa (opsioni manual OpenStreetMap në Pamje) */
const BASEMAP_URL_DARK_LABELS =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const BASEMAP_URL_LIGHT_LABELS =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const BASEMAP_URL = BASEMAP_URL_DARK;
const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Google Satellite — kur shkalla < 10 km (pas zoom-in përtej 10 km).
 * URL: mt0.google.com (subdomains 0123 → mt0…mt3)
 */
/** Gjerësia e shkallës Leaflet (px) — e njëjta me maxWidth në map.js */
const SATELLITE_SCALE_BAR_PX = 96;
/** Sateliti Auto: fiket kur shkalla arrin 10 km; aktivizohet vetëm nën 10 km (5 km, 2 km, …) */
const SATELLITE_MAX_SCALE_METERS = 10000;
/** Aktivizo satelitin vetëm kur shkalla është qartë nën 10 km (etiketa “10 km” mbetet OSM) */
const SATELLITE_AUTO_ON_MAX_METERS = 9000;
/** Emrat e rajoneve vetëm kur shkalla < 30 km (vijat e rajoneve mbeten >= 10 km) */
const RAJON_LABEL_MAX_SCALE_METERS = 30000;
/** Emrat e komunave vetëm kur shkalla < 10 km (vijat e komunave nën ~9 km) */
const KOMUNA_LABEL_MAX_SCALE_METERS = SATELLITE_MAX_SCALE_METERS;
/** Komunat: fshihen kur zoom out, shfaqen kur zoom >= 9 (afrohesh) */
const KOMUNAT_MIN_ZOOM = 9;
/** Emrat e komunave — një hap më afër se vijat */
const KOMUNAT_LABEL_MIN_ZOOM = 11;
/** Satelit i tejdukshëm që simbolet të duken më mirë */
const SATELLITE_LAYER_OPACITY = 0.72;
/** Shtresë e errët poshtë satelitit (kontrast) */
const SATELLITE_DARK_BLEND_OPACITY = 0.38;
const GOOGLE_SATELLITE_URL =
  "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
/** Satelit + emra rrugësh/qytetesh — opsioni manual Google Satellite në Pamje */
const GOOGLE_SATELLITE_LABELS_URL =
  "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
const GOOGLE_SATELLITE_SUBDOMAINS = "0123";
const GOOGLE_SATELLITE_ATTRIBUTION =
  '&copy; <a href="https://www.google.com/maps">Google</a>';

/** Qendra e Kosovës (WGS84) */
const MAP_CENTER = [42.6026, 20.903];
const MAP_ZOOM = 8;

/** Renditja e periudhave në grafik — 6 grupe (CSV ka më shumë vlera të detajuara) */
const CHART_PERIUDHA_ORDER = [
  "parahistorike",
  "antike",
  "mesjetar",
  "osman",
  "moderne",
  "i_panjohor",
];

/** Emra të lexueshëm për boshtin X të grafikut */
const PERIUDHA_LABELS = {
  parahistorike: "Parahistorike",
  antike: "Antike",
  mesjetar: "Mesjetë",
  osman: "Osmane",
  moderne: "Moderne",
  i_panjohor: "I panjohur",
  ilire: "Ilire",
  romak: "Romake",
  antikitet_i_vone: "Antikitet i vonë",
  panjohur: "I panjohur",
};

/** Ngjyra të shtyllave (afër mockup-it) */
const PERIUDHA_COLORS = {
  parahistorike: "#f97316",
  antike: "#38bdf8",
  mesjetar: "#3b82f6",
  osman: "#2dd4bf",
  moderne: "#94a3b8",
  i_panjohor: "#64748b",
  ilire: "#86efac",
  romak: "#38bdf8",
  antikitet_i_vone: "#f59e0b",
  panjohur: "#64748b",
};

/** Butonat e filtrit të periudhave (UI majtas) */
const PERIUDHA_FILTERS = [
  { key: "all", label: "Të gjitha" },
  { key: "parahistorike", label: "Parahistorike" },
  { key: "ilire", label: "Ilire" },
  { key: "romak", label: "Romake" },
  { key: "mesjetar", label: "Mesjetë" },
  { key: "osman", label: "Osmane" },
  { key: "moderne", label: "Moderne" },
  { key: "antikitet_i_vone", label: "Antik. i vonë" },
];

/** Timeline poshtë hartës — etiketat në shirit (pozicion i barabartë si mockup-i) */
const TIMELINE_TICKS = [
  { year: -8000, label: "8000 p.e.s." },
  { year: -1000, label: "1000 p.e.s." },
  { year: 0, label: "0" },
  { year: 500, label: "500 e.s." },
  { year: 1000, label: "1000 e.s." },
  { year: 1500, label: "1500 e.s." },
  { year: 1800, label: "1800 e.s." },
  { year: 2026, label: "Sot" },
];

const TIMELINE_MIN_YEAR = TIMELINE_TICKS[0].year;
const TIMELINE_MAX_YEAR = TIMELINE_TICKS[TIMELINE_TICKS.length - 1].year;

const TIMELINE_PERIODS = [
  { key: "parahistorike", label: "Parahistorike", start: -8000, end: -2500 },
  { key: "ilire", label: "Ilire", start: -1200, end: -168 },
  { key: "romak", label: "Romake", start: -168, end: 550 },
  { key: "mesjetar", label: "Mesjetë", start: 550, end: 1455 },
  { key: "osman", label: "Osmane", start: 1455, end: 1912 },
  { key: "moderne", label: "Moderne", start: 1912, end: 2026 },
];
