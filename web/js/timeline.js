/**
 * SKEDARI: timeline.js
 * QËLLIMI: Paneli kronologjik poshtë hartës — slider dhe butona periudhash për filtrim.
 * KUR NGARKOHET: Pas mobile-ui.js, para map-tools.js (index.html); thirret initTimeline nga map.js.
 * LIDHET ME: config.js (TIMELINE_PERIODS, TIMELINE_TICKS), filters.js (setPeriodFilter),
 *            i18n.js (t, tFormat, getTimelinePeriodLabel), map.js (map.invalidateSize).
 *
 * Paneli poshtë hartës — si mockup-i (ikona + slider portokalli)
 */

// Ikona SVG për çdo periudhë historike në timeline
const TIMELINE_ICONS = {
  parahistorike:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 8v4M9 20l3-8 3 8M8 14h8"/></svg>',
  ilire:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3c-2 4-6 5-6 10a6 6 0 0 0 12 0c0-5-4-6-6-10z"/><path d="M12 13v8M9 18h6"/></svg>',
  romak:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/></svg>',
  mesjetar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 20V10l7-5 7 5v10"/><path d="M5 20h14M9 20v-6h6v6"/><path d="M10 10h4v4h-4z"/></svg>',
  osman:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 6a5 5 0 1 0-5 8.7A6.5 6.5 0 1 1 12 4"/></svg>',
  moderne:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 4h9a3 3 0 0 1 3 3v13H6V4z"/><path d="M6 12h12M9 8h6"/></svg>',
};

// Periudha e zgjedhur aktualisht në timeline (null = të gjitha)
let timelineActiveKey = null;

/** Konverton vitin në pozicion slider (0–1000). */
function yearToSliderPos(year) {
  const y = parseInt(year, 10);
  const ticks = TIMELINE_TICKS;
  if (y <= ticks[0].year) return 0;
  if (y >= ticks[ticks.length - 1].year) return 1000;

  for (let i = 0; i < ticks.length - 1; i++) {
    const a = ticks[i];
    const b = ticks[i + 1];
    if (y >= a.year && y <= b.year) {
      const t = (y - a.year) / (b.year - a.year);
      const pos = (i + t) / (ticks.length - 1);
      return Math.round(pos * 1000);
    }
  }
  return 500;
}

/** Konverton pozicionin e slider-it në vit historik. */
function sliderPosToYear(pos) {
  const p = Math.max(0, Math.min(1000, parseInt(pos, 10))) / 1000;
  const segments = TIMELINE_TICKS.length - 1;
  const f = p * segments;
  const i = Math.min(Math.floor(f), segments - 1);
  const t = f - i;
  const a = TIMELINE_TICKS[i];
  const b = TIMELINE_TICKS[i + 1];
  return Math.round(a.year + t * (b.year - a.year));
}

/** Gjen çelësin e periudhës për një vit të caktuar. */
function getPeriodKeyForYear(year) {
  const y = parseInt(year, 10);
  for (const p of TIMELINE_PERIODS) {
    if (y >= p.start && y <= p.end) return p.key;
  }
  return null;
}

/** Përditëson shiritin portokalli të mbushur në slider. */
function updateSliderFill() {
  const slider = document.getElementById("timelineSlider");
  const fill = document.getElementById("timelineFill");
  if (!slider || !fill) return;
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  fill.style.width = pct + "%";
}

/** Thekson butonin e periudhës aktive në rreshtin e ikonave. */
function setTimelineActiveKey(key) {
  timelineActiveKey = key === "all" || !key ? null : key;
  document.querySelectorAll("[data-timeline-period]").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      timelineActiveKey && btn.dataset.timelinePeriod === timelineActiveKey
    );
  });
}

/** Vizaton butonat e periudhave me ikona dhe etiketa. */
function renderTimelinePeriods() {
  const periodRow = document.getElementById("timelinePeriods");
  if (!periodRow) return;

  periodRow.innerHTML = TIMELINE_PERIODS.map((p) => {
    const label = getTimelinePeriodLabel(p.key);
    const title = tFormat("timeline.periodTitle", {
      label,
      start: p.start,
      end: p.end,
    });
    return (
      '<button type="button" class="tl-period-btn" data-timeline-period="' +
      p.key +
      '" title="' +
      title +
      '">' +
      '<span class="tl-period-icon">' +
      (TIMELINE_ICONS[p.key] || "") +
      "</span>" +
      '<span class="tl-period-label">' +
      label +
      "</span>" +
      "</button>"
    );
  }).join("");

  setTimelineActiveKey(timelineActiveKey);
}

/** Vizaton shënuesit dhe etiketat e viteve në shiritin kronologjik. */
function renderTimelineTicks() {
  const marks = document.getElementById("timelineTickMarks");
  const labels = document.getElementById("timelineTickLabels");
  if (!marks || !labels) return;

  const n = TIMELINE_TICKS.length - 1;
  marks.innerHTML = "";
  labels.innerHTML = "";

  TIMELINE_TICKS.forEach((tick, i) => {
    const left = (i / n) * 100;
    const label =
      typeof getTimelineTickLabel === "function"
        ? getTimelineTickLabel(tick.year)
        : tick.label;
    marks.innerHTML +=
      '<span class="timeline-tick-mark" style="left:' + left + '%"></span>';
    const labelClass =
      "timeline-tick-label" +
      (i === 0 ? " timeline-tick-label--start" : "") +
      (i === 1 ? " timeline-tick-label--early" : "") +
      (i === n ? " timeline-tick-label--end" : "");
    labels.innerHTML +=
      '<span class="' +
      labelClass +
      '" style="left:' +
      left +
      '%">' +
      label +
      "</span>";
  });
}

/** Aplikon filtrin e periudhës bazuar në pozicionin aktual të slider-it. */
function applyYearFromSlider(pos) {
  const year = sliderPosToYear(pos);
  updateSliderFill();
  const periodKey = getPeriodKeyForYear(year);

  if (typeof setPeriodFilter !== "function") return;

  if (periodKey) {
    setPeriodFilter(periodKey, true);
    setTimelineActiveKey(periodKey);
  } else {
    setPeriodFilter("all", true);
    setTimelineActiveKey(null);
  }
}

/** Sinkronizon slider-in dhe butonat kur filtri ndryshon nga jashtë (p.sh. chips). */
function syncTimelineUI(periodKey) {
  const slider = document.getElementById("timelineSlider");
  if (!slider) return;

  setTimelineActiveKey(periodKey);

  if (!periodKey) {
    slider.value = String(yearToSliderPos(0));
    updateSliderFill();
    return;
  }

  const p = TIMELINE_PERIODS.find((x) => x.key === periodKey);
  if (p) {
    const mid = Math.round((p.start + p.end) / 2);
    slider.value = String(yearToSliderPos(mid));
    updateSliderFill();
  }
}

/** Inicializon timeline, lidh klikimet dhe slider-in me filtrin. */
function initTimeline() {
  const periodRow = document.getElementById("timelinePeriods");
  const slider = document.getElementById("timelineSlider");
  if (!periodRow || !slider) return;

  if (typeof setPeriodFilter === "function") {
    setPeriodFilter("all", true);
  }
  setTimelineActiveKey(null);

  renderTimelinePeriods();
  renderTimelineTicks();
  slider.value = String(yearToSliderPos(500));
  updateSliderFill();

  // Klikimi i butonave të periudhave — toggle ose zgjedh periudhë
  periodRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-timeline-period]");
    if (!btn) return;
    const key = btn.dataset.timelinePeriod;

    if (timelineActiveKey === key) {
      slider.value = String(yearToSliderPos(0));
      updateSliderFill();
      setPeriodFilter("all");
      setTimelineActiveKey(null);
      return;
    }

    const p = TIMELINE_PERIODS.find((x) => x.key === key);
    if (p) {
      const mid = Math.round((p.start + p.end) / 2);
      slider.value = String(yearToSliderPos(mid));
      updateSliderFill();
    }
    setPeriodFilter(key);
    setTimelineActiveKey(key);
  });

  // Lëvizja e slider-it filtron sipas vitit
  slider.addEventListener("input", () => {
    applyYearFromSlider(slider.value);
  });

  // Rifreskon madhësinë e hartës pas ngarkimit të timeline
  setTimeout(() => {
    if (typeof map !== "undefined") map.invalidateSize();
  }, 200);
}

window.initTimeline = initTimeline;
window.syncTimelineUI = syncTimelineUI;
window.renderTimelinePeriods = renderTimelinePeriods;
window.renderTimelineTicks = renderTimelineTicks;
