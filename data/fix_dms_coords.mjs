/**
 * Konverton lat/lon nga DMS / formate të ndryshme → decimale (WGS84).
 * Përdorim: node fix_dms_coords.mjs sites_arkitekturore.csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, process.argv[2] || 'sites_arkitekturore.csv');

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const readField = () => {
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
  while (i < len && text[i] !== '\n') header.push(readField());
  if (text[i] === '\n') i++;
  while (i < len) {
    if (text[i] === '\r' || text[i] === '\n') {
      i++;
      continue;
    }
    const row = {};
    for (const h of header) row[h] = readField();
    if (Object.values(row).some((v) => v !== '')) rows.push(row);
    while (i < len && (text[i] === '\n' || text[i] === '\r')) i++;
  }
  return { header, rows };
}

function esc(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Vlerë → gradë decimale */
function toDecimal(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw).trim().replace(/\uFEFF/g, '');

  // Tashmë decimal (p.sh. 42.385639)
  if (/^-?\d+(\.\d+)?$/.test(s.replace(',', '.'))) {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  // Kompakt: 423658 → 42°36'58", 212554 → 21°25'54"
  if (/^\d{6}$/.test(s)) {
    const d = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2, 4), 10);
    const sec = parseFloat(s.slice(4, 6));
    if (m < 60 && sec < 60) return d + m / 60 + sec / 3600;
  }
  if (/^\d{7}$/.test(s)) {
    const d = parseInt(s.slice(0, 3), 10);
    const m = parseInt(s.slice(3, 5), 10);
    const sec = parseFloat(s.slice(5, 7));
    if (d <= 180 && m < 60) return d + m / 60 + sec / 3600;
  }

  s = s
    .replace(/˚/g, '°')
    .replace(/''/g, '"')
    .replace(/″/g, '"')
    .replace(/′/g, "'")
    .replace(/\s+/g, '');

  // 42°06'38.35" ose 42006'38.35" (pa simbolin °)
  let m = s.match(/^(\d{2,3})(\d{2})['']([\d.]+)"?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return d + min / 60 + sec / 3600;
  }

  // 4222'56.06" (mungojnë ° dhe shifra e parë e minutave)
  m = s.match(/^(\d{2,3})[''](\d{1,2})['']([\d.]+)"?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return d + min / 60 + sec / 3600;
  }

  // 20°25'37.48"
  m = s.match(/^(\d{1,3})°?(\d{1,2})['']([\d.]+)"?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return d + min / 60 + sec / 3600;
  }

  // 2025'30.13" → 20°25'30.13"
  m = s.match(/^(\d{2})(\d{2})['']([\d.]+)"?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    if (min < 60) return d + min / 60 + sec / 3600;
  }

  return null;
}

function fixPair(latRaw, lonRaw) {
  let lat = toDecimal(latRaw);
  let lon = toDecimal(lonRaw);

  // DTK shpesh i vendos të kundërt (lon në kolonën lat)
  if (lat != null && lon != null) {
    if (lat >= 20 && lat <= 22.5 && lon >= 41.5 && lon <= 43.5) {
      [lat, lon] = [lon, lat];
    }
  } else if (lat != null && lon == null && lat >= 41.5 && lat <= 43.5) {
    // vetëm një vlerë
  } else if (lat != null && lon == null && lat >= 20 && lat <= 22.5) {
    lon = lat;
    lat = null;
  }

  return { lat, lon, changed: latRaw !== (lat?.toFixed(7) ?? '') || lonRaw !== (lon?.toFixed(7) ?? '') };
}

const raw = fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, '');
const { header, rows } = parseCsv(raw);

let fixed = 0;
let swapped = 0;

for (const r of rows) {
  const beforeLat = r.lat;
  const beforeLon = r.lon;
  const { lat, lon } = fixPair(r.lat, r.lon);

  if (lat != null && lon != null) {
    if (toDecimal(beforeLat) >= 20 && toDecimal(beforeLat) <= 22.5 && toDecimal(beforeLon) >= 41.5) {
      swapped++;
    }
    const newLat = lat.toFixed(7);
    const newLon = lon.toFixed(7);
    if (beforeLat !== newLat || beforeLon !== newLon) {
      fixed++;
      r.lat = newLat;
      r.lon = newLon;
      if (!r.koordinata_burimi.includes('DMS→decimal')) {
        r.koordinata_burimi = `${r.koordinata_burimi}; DMS→decimal`.replace(/^; /, '');
      }
    }
  }
}

const lines = [header.join(',')];
for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
fs.writeFileSync(FILE, '\uFEFF' + lines.join('\n'), 'utf8');

console.log(`Skedar: ${FILE}`);
console.log(`Rreshta të përditësuar: ${fixed}`);
console.log(`Lat/lon të këmbyer (DTK): ${swapped}`);

spawnSync('node', [path.join(__dirname, 'convert_kosovaref01.js'), FILE, FILE], {
  stdio: 'inherit',
  cwd: __dirname,
});
