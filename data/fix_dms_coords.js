/**
 * Konverton lat/lon nga DMS → decimale në CSV arkitekturore.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FILE = path.join(__dirname, process.argv[2] || 'sites_arkitekturore.csv');

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const readField = () => {
    if (i >= len) return '';
    let field = '';
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      if (text[i] === ',') i++;
      return field;
    }
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      field += text[i++];
    }
    if (text[i] === ',') i++;
    return field;
  };
  const header = [];
  let guard = 0;
  while (i < len && text[i] !== '\n' && text[i] !== '\r') {
    if (++guard > 30) throw new Error('CSV header parse failed');
    header.push(readField());
  }
  if (text[i] === '\r') i++;
  if (text[i] === '\n') i++;
  while (i < len) {
    if (text[i] === '\r') {
      i++;
      continue;
    }
    if (text[i] === '\n') {
      i++;
      continue;
    }
    const row = {};
    guard = 0;
    for (const h of header) {
      if (++guard > 30) throw new Error('CSV row parse failed at ' + i);
      row[h] = readField();
    }
    if (Object.values(row).some((v) => v !== '')) rows.push(row);
    while (i < len && (text[i] === '\n' || text[i] === '\r')) i++;
  }
  return { header, rows };
}

function esc(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function toDecimal(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw).trim().replace(/\uFEFF/g, '').replace(/;+$/, '');

  s = s
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/˚/g, '°')
    .replace(/''+/g, '"')
    .replace(/″/g, '"')
    .replace(/′/g, "'")
    .replace(/\s+/g, '');

  // 423658 → 42°36'58" (kompakt, pa simbole)
  if (/^\d{6}$/.test(s)) {
    const d = parseInt(s.slice(0, 2), 10);
    const min = parseInt(s.slice(2, 4), 10);
    const sec = parseFloat(s.slice(4, 6));
    if (d >= 20 && d <= 43 && min < 60 && sec < 60) return d + min / 60 + sec / 3600;
  }

  // 42006'38.35" / 4207'02.27" / 20042'35.03" (DD + MM'SS", pa °)
  let m = s.match(/^(\d{2})(\d+)['"]([\d.]+)"?$/);
  if (m) {
    const deg = parseInt(m[1], 10);
    const rest = m[2];
    const sec = parseFloat(m[3]);
    const min = parseInt(rest.slice(-2).padStart(2, '0'), 10);
    if (deg >= 20 && deg <= 43 && min < 60) return deg + min / 60 + sec / 3600;
    if (deg >= 20 && deg <= 22 && min < 60) return deg + min / 60 + sec / 3600;
  }

  // 42.17'16.72" (gradë me pikë + minuta + sekonda)
  m = s.match(/^(\d{1,2})\.(\d{1,2})['"]([\d.]+)"?$/);
  if (m) {
    const min = parseInt(m[2], 10);
    let sec = parseFloat(m[3]);
    if (sec >= 60) sec = sec % 60; // gabim DTK: 81.08 → 21.08
    if (min < 60) return parseInt(m[1], 10) + min / 60 + sec / 3600;
  }

  // 420-12'-55.27" → 42°12'55.27"
  m = s.match(/^(\d{2})-(\d{1,2})['"]-?([\d.]+)"?/);
  if (m) {
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return parseInt(m[1], 10) + min / 60 + sec / 3600;
  }

  // 42°22'54.59" ose 42˚22'54.59"
  m = s.match(/^(\d{1,2})°?(\d{1,2})['"]([\d.]+)"?$/);
  if (m) {
    const min = parseInt(m[2], 10);
    let sec = parseFloat(m[3]);
    if (sec >= 60) sec = sec % 60;
    if (min < 60) return parseInt(m[1], 10) + min / 60 + sec / 3600;
  }

  // 4222'56.06" (mungojnë °)
  m = s.match(/^(\d{2})(\d{2})['"]([\d.]+)"?$/);
  if (m) {
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return parseInt(m[1], 10) + min / 60 + sec / 3600;
  }

  // 2025'30.13" → 20°25'30.13"
  m = s.match(/^(\d{2})(\d{2})['"]([\d.]+)"?$/);
  if (m) {
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return parseInt(m[1], 10) + min / 60 + sec / 3600;
  }

  // Tashmë decimal (vetëm nëse është diapazoni gjeografik i Kosovës)
  if (/^-?\d+(\.\d+)?$/.test(s.replace(',', '.'))) {
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n) && n >= 20 && n <= 43) return n;
    if (Number.isFinite(n) && n > 100) return null; // 423658 gabim si decimal
  }

  return null;
}

function fixPair(latRaw, lonRaw) {
  let lat = toDecimal(latRaw);
  let lon = toDecimal(lonRaw);

  if (lat != null && lon != null && lat >= 20 && lat <= 22.5 && lon >= 41.5 && lon <= 43.5) {
    [lat, lon] = [lon, lat];
  }

  return { lat, lon };
}

const raw = fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, '');
const { header, rows } = parseCsv(raw);

let fixed = 0;
for (const r of rows) {
  const lat0 = r.lat;
  const lon0 = r.lon;
  const { lat, lon } = fixPair(r.lat, r.lon);
  if (lat == null || lon == null) continue;

  const newLat = lat.toFixed(7);
  const newLon = lon.toFixed(7);
  if (lat0 !== newLat || lon0 !== newLon) {
    fixed++;
    r.lat = newLat;
    r.lon = newLon;
    if (!String(r.koordinata_burimi || '').includes('DMS→decimal')) {
      r.koordinata_burimi = r.koordinata_burimi
        ? `${r.koordinata_burimi}; DMS→decimal`
        : 'DTK; DMS→decimal';
    }
  }
}

const lines = [header.join(',')];
for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
fs.writeFileSync(FILE, '\uFEFF' + lines.join('\n'), 'utf8');

console.log(`Përditësuar: ${fixed} rreshta me koordinata decimale`);

spawnSync('node', [path.join(__dirname, 'convert_kosovaref01.js'), FILE, FILE], {
  stdio: 'inherit',
});
