/**
 * SKEDARI: chart.js
 * QËLLIMI: Statistikë vizuale — grafikë sipas periudhës, komunës/rajonit dhe eksport CSV.
 * KUR NGARKOHET: Pas symbology-user.js, para detail.js (index.html); init në DOMContentLoaded.
 * LIDHET ME: config.js (CHART_PERIUDHA_ORDER, PERIUDHA_*), filters.js (getFilteredFeatures),
 *            data-i18n.js (translateDataValue), map.js (WFS_URL), i18n.js (t, tFormat).
 *
 * Statistikë — periudha + komuna / rajon
 */

// Modaliteti i grafikut gjeografik: komuna ose rajon
let chartGeoMode = "komuna";
let komunaRajonMap = null;
let komunaRajonMapLoading = null;

/** Normalizon fushën e periudhës nga properties në çelës të unifikuar. */
function normalizePeriudha(props) {
  const raw = (
    props.periudha ||
    props.PERIUDHA ||
    props.periudha_detaj ||
    props.PERIUDHA_DETAJ ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (!raw) return "i_panjohor";

  if (
    raw.includes("neolit") ||
    raw.includes("bronz") ||
    raw.includes("hekur") ||
    raw.includes("paleolit") ||
    raw.includes("parahistor")
  ) {
    return "parahistorike";
  }
  if (raw.includes("romak") || raw === "romake") return "romak";
  if (raw.includes("antikitet")) return "antikitet_i_vone";
  if (raw.includes("mesjet")) return "mesjetar";
  if (raw.includes("osman")) return "osman";
  if (raw.includes("ilir")) return "ilire";
  if (raw.includes("modern")) return "moderne";
  if (raw.includes("panjoh")) return "i_panjohor";

  return raw;
}

/** Grupon periudhat afër për grafikun (antike, i panjohur, etj.). */
function normalizePeriudhaForChart(props) {
  const key = normalizePeriudha(props);

  if (key === "romak" || key === "antikitet_i_vone" || key === "ilire") {
    return "antike";
  }
  if (key === "panjohur" || key === "i_panjohur") {
    return "i_panjohor";
  }

  if (CHART_PERIUDHA_ORDER.includes(key)) return key;
  return "i_panjohor";
}

/** Normalizon emrin gjeografik për krahasim (pa theks, pa prefiks "Komuna e"). */
function normalizeGeoKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^municipality of\s+/i, "")
    .replace(/^komuna e\s+/i, "")
    .replace(/^bashkia e\s+/i, "")
    .replace(/\s+/g, " ");
}

/** Komuna/rajon jo i vlefshëm për statistika (N.A., bosh, Kosovë, etj.). */
function isInvalidKomunaValue(raw) {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (/^kosov/i.test(s)) return true;
  const compact = s.replace(/\s+/g, "").replace(/\./g, "").toLowerCase();
  if (compact === "na" || compact === "n/a") return true;
  const key = normalizeGeoKey(s).replace(/\./g, "");
  if (key === "na" || key === "n a") return true;
  if (key === "unknown" || key === "i panjohur") return true;
  return false;
}

/** Formato emrin e komunës për shfaqje (heq prefiks, përkthe në EN). */
function formatKomunaLabel(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^Municipality of\s+/i, "");
  s = s.replace(/^Komuna e\s+/i, "");
  s = s.replace(/^Bashkia e\s+/i, "");
  s = s.trim() || getGeoUnknownLabel();
  if (
    s !== getGeoUnknownLabel() &&
    typeof translateDataValue === "function" &&
    typeof getLang === "function" &&
    getLang() === "en"
  ) {
    return translateDataValue("komuna", s);
  }
  return s;
}

/** Formato emrin e rajonit për shfaqje. */
function formatRajonLabel(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return getGeoUnknownLabel();
  if (typeof translateRajonDisplayName === "function") {
    return translateRajonDisplayName(s);
  }
  if (/^rajoni i\s+/i.test(s)) return s;
  return "Rajoni i " + s.replace(/^Rajoni i\s+/i, "");
}

/** Normalizon emrin e rajonit për çelës krahasimi. */
function normalizeRajonKey(name) {
  return normalizeGeoKey(String(name || "").replace(/^Rajoni i\s+/i, ""));
}

/** Kthen listën e rajoneve unike nga harta komuna→rajon. */
function getCanonicalRajons(rajonMap) {
  const keys = new Set();
  Object.values(rajonMap || {}).forEach((rajon) => {
    if (rajon && rajon !== getGeoUnknownLabel()) keys.add(rajon);
  });
  return [...keys].sort((a, b) => a.localeCompare(b, "sq"));
}

/** Bashkon numërimet sipas emrave kanonikë të rajoneve. */
function applyRajonLabels(counts, rajonMap) {
  const canonical = getCanonicalRajons(rajonMap);
  const merged = {};
  canonical.forEach((rajon) => {
    merged[rajon] = 0;
  });

  Object.entries(counts).forEach(([label, value]) => {
    if (label === getGeoUnknownLabel()) return;
    merged[label] = (merged[label] || 0) + value;
  });

  return merged;
}

/** Nxjerr emrin e komunës nga properties e një feature. */
function getKomunaFromProps(props) {
  const p = props || {};
  const raw =
    p.komuna ?? p.KOMUNA ?? p.komuna_emri ?? p.municipality ?? p.shapeName;
  if (!raw || !String(raw).trim() || isInvalidKomunaValue(raw)) {
    return null;
  }
  return formatKomunaLabel(raw);
}

/** Gjen emrin kanonik të rajonit nga etiketa ose harta. */
function resolveRajonLabel(label, rajonMap) {
  if (!label || label === getGeoUnknownLabel()) return null;

  const canonical = getCanonicalRajons(rajonMap);
  const key = normalizeRajonKey(label);
  for (const rajon of canonical) {
    if (normalizeRajonKey(rajon) === key) return rajon;
  }

  return formatRajonLabel(label);
}

/** Përcakton rajonin nga properties, harta komuna→rajon ose teksti. */
function getRajonFromProps(props, map) {
  const p = props || {};
  const direct = p.Rajoni ?? p.rajoni ?? p.rajon;
  if (
    direct &&
    String(direct).trim() &&
    !/^kosov/i.test(String(direct))
  ) {
    return resolveRajonLabel(formatRajonLabel(direct), map);
  }

  const komunaLabel = getKomunaFromProps(p);
  const komunaKey = komunaLabel ? normalizeGeoKey(komunaLabel) : "";
  if (komunaKey && map && map[komunaKey]) return map[komunaKey];

  const text = String(p.shenime || p.pershkrim_i_shkurter || "");
  const m = text.match(/Rajoni i\s+([^,\).]+)/i);
  if (m) {
    return resolveRajonLabel(formatRajonLabel("Rajoni i " + m[1].trim()), map);
  }

  return null;
}

/** Numëron monumentet sipas periudhës për grafikun vertikal. */
function countByPeriudha(features) {
  const counts = {};
  for (const f of features) {
    const key = normalizePeriudhaForChart(f.properties || {});
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** Numëron monumentet sipas komunës ose rajonit. */
function countByField(features, mode, rajonMap) {
  const counts = {};
  for (const f of features) {
    const label =
      mode === "rajon"
        ? getRajonFromProps(f.properties || {}, rajonMap)
        : getKomunaFromProps(f.properties || {});
    if (label == null) continue;
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

/** Kthen etiketën e periudhës për grafik (me përkthim i18n). */
function getPeriodChartLabel(key) {
  if (typeof t === "function") {
    const translated = t("period." + key);
    if (translated && translated !== "period." + key) return translated;
  }
  return PERIUDHA_LABELS[key] || key;
}

/** Ndërton rreshtat e grafikut vertikal sipas renditjes së periudhave. */
function buildChartRows(counts) {
  const rows = [];

  for (const key of CHART_PERIUDHA_ORDER) {
    if (counts[key]) {
      rows.push({
        key,
        label: getPeriodChartLabel(key),
        value: counts[key],
        color: PERIUDHA_COLORS[key] || "#64748b",
      });
    }
  }

  return rows;
}

/** Merr N komunat/rajonet me më shumë monumente. */
function buildTopRows(counts, limit, color) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value,
      color,
    }));
}

/** Ndërton rreshtat e grafikut horizontal për rajonet. */
function buildRajonRows(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sq"))
    .map(([label, value]) => ({
      label,
      value,
      color: "#b8a574",
    }));
}

/** Vizaton grafikun vertikal të periudhave në DOM. */
function renderPeriodChart(container, rows) {
  if (!container) return;

  if (!rows.length) {
    container.innerHTML =
      '<p class="chart-empty">' + t("chart.emptyWfs") + "</p>";
    return;
  }

  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  container.innerHTML =
    '<div class="vchart vchart--compact vchart--sm">' +
    rows
      .map(
        (r) =>
          '<div class="vchart-col" title="' +
          r.label +
          ": " +
          r.value +
          '">' +
          '<span class="vchart-value">' +
          r.value +
          "</span>" +
          '<div class="vchart-track">' +
          '<div class="vchart-fill" style="height:' +
          Math.round((r.value / maxVal) * 100) +
          "%;background:" +
          r.color +
          '"></div>' +
          "</div>" +
          '<span class="vchart-label">' +
          r.label +
          "</span>" +
          "</div>"
      )
      .join("") +
    "</div>";
}

/** Vizaton grafikun horizontal të komunave/rajoneve në DOM. */
function renderGeoChart(container, rows, mode) {
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p class="chart-empty">' + t("chart.empty") + "</p>";
    return;
  }

  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const barColor = mode === "rajon" ? "#b8a574" : "#5eead4";

  container.innerHTML =
    '<div class="hchart">' +
    rows
      .map(
        (r) =>
          '<div class="hchart-row" title="' +
          r.label +
          ": " +
          r.value +
          '">' +
          '<span class="hchart-label">' +
          r.label +
          "</span>" +
          '<div class="hchart-track">' +
          '<div class="hchart-fill" style="width:' +
          Math.max(6, Math.round((r.value / maxVal) * 100)) +
          "%;background:" +
          barColor +
          '"></div>' +
          "</div>" +
          '<span class="hchart-value">' +
          r.value +
          "</span>" +
          "</div>"
      )
      .join("") +
    "</div>";
}

function buildKomunaRajonMapFromFeatures(features) {
  const map = {};
  (features || []).forEach((f) => {
    const p = f.properties || {};
    const komuna = formatKomunaLabel(
      p.shapeName || p.emri || p.komuna || p.name || p.KOMUNA
    );
    const rajon = p.Rajoni || p.rajoni || p.rajon;
    if (komuna && rajon && !/^kosov/i.test(String(rajon))) {
      map[normalizeGeoKey(komuna)] = formatRajonLabel(rajon);
    }
  });
  return map;
}

function loadStaticKomunaRajonMap() {
  const base = typeof tkkAppBase === "function" ? tkkAppBase() : "";
  return fetch(base + "data/boundaries/komunat.geojson", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { features: [] }))
    .then((data) => buildKomunaRajonMapFromFeatures(data.features || []))
    .catch(() => ({}));
}

/** Ngarkon hartën komuna→rajon nga WFS GeoServer (ose GeoJSON statik). */
function loadKomunaRajonMap() {
  if (komunaRajonMap && Object.keys(komunaRajonMap).length) {
    return Promise.resolve(komunaRajonMap);
  }
  if (komunaRajonMapLoading) return komunaRajonMapLoading;

  if (typeof WFS_URL === "undefined" || !WFS_URL || typeof WMS_LAYERS === "undefined") {
    komunaRajonMapLoading = loadStaticKomunaRajonMap().then((map) => {
      komunaRajonMap = map;
      return map;
    });
    return komunaRajonMapLoading;
  }

  const typeName =
    (typeof WFS_LAYER_ALIASES !== "undefined" &&
      WFS_LAYER_ALIASES.komunat &&
      WFS_LAYER_ALIASES.komunat[0]) ||
    WMS_LAYERS.komunat;

  const url =
    WFS_URL +
    "?service=WFS&version=1.0.0&request=GetFeature" +
    "&typeName=" +
    encodeURIComponent(typeName) +
    "&outputFormat=application/json" +
    "&srsName=EPSG:4326";

  komunaRajonMapLoading = fetch(url, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { features: [] }))
    .then((data) => buildKomunaRajonMapFromFeatures(data.features || []))
    .then((map) => {
      if (Object.keys(map).length) {
        komunaRajonMap = map;
        return map;
      }
      return loadStaticKomunaRajonMap().then((staticMap) => {
        komunaRajonMap = staticMap;
        return staticMap;
      });
    })
    .catch(() =>
      loadStaticKomunaRajonMap().then((staticMap) => {
        komunaRajonMap = staticMap;
        return staticMap;
      })
    );

  return komunaRajonMapLoading;
}

/** Përditëson grafikun gjeografik (komuna ose rajon). */
function updateGeoChart(allFeatures) {
  const container = document.getElementById("chartGeoBars");
  const totalEl = document.getElementById("chartGeoTotal");
  if (!container) return;

  loadKomunaRajonMap().then((rajonMap) => {
    const rawCounts = countByField(allFeatures || [], chartGeoMode, rajonMap);

    let rows;
    let totalLabel;

    if (chartGeoMode === "rajon") {
      const counts = applyRajonLabels(rawCounts, rajonMap);
      rows = buildRajonRows(counts);
      totalLabel = t("stats.regionsCount").replace("{n}", String(rows.length));
    } else {
      rows = buildTopRows(rawCounts, 8, null);
      const distinct = Object.keys(rawCounts).length;
      totalLabel = t("stats.topKomuna")
        .replace("{top}", String(rows.length))
        .replace("{total}", String(distinct));
    }

    if (totalEl) {
      totalEl.textContent = totalLabel;
    }

    renderGeoChart(container, rows, chartGeoMode);
  });
}

/** Përditëson grafikun e periudhave dhe totalin e monumenteve. */
function updatePeriudhaChart(allFeatures) {
  const container = document.getElementById("chartBars");
  const totalEl = document.getElementById("chartTotal");
  if (!container) return;

  try {
    const counts = countByPeriudha(allFeatures || []);
    const rows = buildChartRows(counts);

    if (totalEl) {
      totalEl.textContent = tFormat("stats.totalMonumentsLayers", {
        n: allFeatures?.length || 0,
        layers: t("stats.allLayers"),
      });
    }

    renderPeriodChart(container, rows);
    updateGeoChart(getChartFeatures());
  } catch (e) {
    console.error("Grafik:", e);
    container.innerHTML = '<p class="chart-empty">' + t("chart.error") + "</p>";
  }
}

/** Kthen feature-t e filtruara ose të gjitha për grafik/eksport. */
function getChartFeatures() {
  if (typeof getFilteredFeatures === "function") {
    return getFilteredFeatures();
  }
  return window.allMonumentFeatures || [];
}

/** Escape një qelizë CSV (thonjëza nëse ka presje/rrjeshta). */
function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Ndërton rreshtat e eksportit CSV për çdo monument. */
function buildMonumentExportRows(features, rajonMap) {
  return (features || []).map((f) => {
    const p = f.properties || {};
    const periudhaKey = normalizePeriudhaForChart(p);
    const periudhaGrup = PERIUDHA_LABELS[periudhaKey] || periudhaKey;
    const periudhaRaw =
      typeof translatePeriudhaDisplay === "function"
        ? translatePeriudhaDisplay(p)
        : p.periudha_detaj || p.PERIUDHA_DETAJ || p.periudha || p.PERIUDHA || "";
    const periudhaGrupOut =
      typeof getLang === "function" && getLang() === "en"
        ? getPeriodChartLabel(periudhaKey)
        : periudhaGrup;
    const emriRaw = p.emri || p.EMRI || "";
    const emriOut =
      typeof translateDataValue === "function"
        ? translateDataValue("emri", emriRaw, p)
        : emriRaw;
    const llojiKey = p.lloji_trashegimise || p.LLOJI_TRASHEGIMISE || "";
    const llojiOut =
      typeof getHeritageTypeLabel === "function"
        ? getHeritageTypeLabel(llojiKey)
        : llojiKey;
    return {
      id: p.id || p.ID || "",
      emri: emriOut,
      periudha: periudhaRaw,
      periudha_grup: periudhaGrupOut,
      komuna: getKomunaFromProps(p) || "",
      rajon: getRajonFromProps(p, rajonMap) || "",
      lloji: llojiOut,
    };
  });
}

/** Shton një seksion përmbledhës në skedarin CSV. */
function appendSummarySection(lines, title, counts) {
  lines.push("");
  lines.push(title);
  lines.push(t("chart.csvHeader"));
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sq"))
    .forEach(([name, n]) => {
      lines.push(escapeCsvCell(name) + "," + n);
    });
}

/** Ndërton përmbajtjen e plotë të CSV-së së statistikave. */
function buildStatisticsCsv(features, rajonMap) {
  const lines = [];
  const periudhaCounts = countByPeriudha(features);
  const komunaCounts = countByField(features, "komuna", rajonMap);
  const rajonCounts = applyRajonLabels(
    countByField(features, "rajon", rajonMap),
    rajonMap
  );

  const periudhaLabels = {};
  Object.entries(periudhaCounts).forEach(([key, n]) => {
    periudhaLabels[getPeriodChartLabel(key) || key] = n;
  });

  lines.push(t("chart.csvTitle"));
  lines.push(t("chart.csvDate") + "," + new Date().toISOString().slice(0, 10));
  lines.push(t("chart.csvMonuments") + "," + (features?.length || 0));

  appendSummarySection(lines, t("chart.csvByPeriod"), periudhaLabels);
  appendSummarySection(lines, t("chart.csvByKomuna"), komunaCounts);
  appendSummarySection(lines, t("chart.csvByRajon"), rajonCounts);

  lines.push("");
  lines.push(t("chart.csvList"));
  lines.push(t("chart.csvMonumentCols"));

  buildMonumentExportRows(features, rajonMap).forEach((r) => {
    lines.push(
      [
        escapeCsvCell(r.id),
        escapeCsvCell(r.emri),
        escapeCsvCell(r.periudha),
        escapeCsvCell(r.periudha_grup),
        escapeCsvCell(r.komuna),
        escapeCsvCell(r.rajon),
        escapeCsvCell(r.lloji),
      ].join(",")
    );
  });

  return lines.join("\r\n");
}

window.buildStatisticsCsv = buildStatisticsCsv;

/** Shkarkon skedarin CSV me statistika monumentesh. */
function downloadStatisticsCsv() {
  const features = getChartFeatures();
  if (!features.length) {
    window.alert(t("chart.noDownload"));
    return;
  }

  loadKomunaRajonMap().then((rajonMap) => {
    const csv = "\uFEFF" + buildStatisticsCsv(features, rajonMap);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "monumente-statistika-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

/** Lidh butonin e shkarkimit CSV me downloadStatisticsCsv. */
function initChartDownload() {
  document
    .getElementById("chartDownloadBtn")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      downloadStatisticsCsv();
    });
}

/** Inicializon tabs komuna/rajon për grafikun gjeografik. */
function initChartGeoTabs() {
  const tabs = document.querySelectorAll(".chart-geo-tab[data-chart-geo]");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      chartGeoMode = tab.dataset.chartGeo || "komuna";
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      updateGeoChart(getChartFeatures());
    });
  });
}

// Inicializon tabs dhe shkarkimin kur DOM është gati
document.addEventListener("DOMContentLoaded", () => {
  initChartGeoTabs();
  initChartDownload();
});

// Rifreskon grafikët kur ndryshon gjuha
window.addEventListener("tkk:lang-change", () => {
  if (typeof updatePeriudhaChart === "function") {
    updatePeriudhaChart(
      typeof getFilteredFeatures === "function"
        ? getFilteredFeatures()
        : window.allMonumentFeatures || []
    );
  }
  applyI18n(document.getElementById("sidebarFlyoutChart"));
});

// Eksporton funksionet e normalizimit dhe grafikëve për filters, timeline, map
window.normalizePeriudha = normalizePeriudha;
window.normalizePeriudhaForChart = normalizePeriudhaForChart;
window.countByPeriudha = countByPeriudha;
window.updatePeriudhaChart = updatePeriudhaChart;
window.loadKomunaRajonMap = loadKomunaRajonMap;
window.getKomunaFromProps = getKomunaFromProps;
window.isInvalidKomunaValue = isInvalidKomunaValue;
window.getRajonFromProps = getRajonFromProps;
window.getCanonicalRajons = getCanonicalRajons;
