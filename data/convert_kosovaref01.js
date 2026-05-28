/**
 * Konverton lat/lon (WGS84 / EPSG:4326, si në DTK) → KosovaRef01 të proyectuar (EPSG:9141).
 * Përdorim në QGIS / GeoServer si në detyrën Web GIS.
 */
const fs = require('fs');
const path = require('path');
const proj4 = require('./proj4.js');

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
proj4.defs(
  'EPSG:9141',
  '+proj=tmerc +lat_0=0 +lon_0=21 +k=0.9999 +x_0=7500000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs',
);

const SRC = process.argv[2] || path.join(__dirname, 'sites_arkeologjike.csv');
const DST = process.argv[3] || SRC;

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
    if (text[i] === '\r') {
      i++;
      continue;
    }
    if (text[i] === '\n') {
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

function convert(lon, lat) {
  const lo = parseFloat(lon);
  const la = parseFloat(lat);
  if (!Number.isFinite(lo) || !Number.isFinite(la)) return { e: '', n: '' };
  const [e, n] = proj4('EPSG:4326', 'EPSG:9141', [lo, la]);
  return { e: e.toFixed(3), n: n.toFixed(3) };
}

const raw = fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '');
const { header, rows } = parseCsv(raw);

const extra = ['easting_kosovaref01', 'northing_kosovaref01', 'sistemi_projeksion'];
const outHeader = [...header];
for (const col of extra) {
  if (!outHeader.includes(col)) outHeader.push(col);
}

const lines = [outHeader.join(',')];
for (const row of rows) {
  const { e, n } = convert(row.lon, row.lat);
  row.easting_kosovaref01 = e;
  row.northing_kosovaref01 = n;
  row.sistemi_projeksion = e && n ? 'EPSG:9141 (KOSOVAREF01 / Balkans zone 7)' : '';
  if (row.koordinata_burimi && e) {
    row.koordinata_burimi = `${row.koordinata_burimi}; konvertuar WGS84→EPSG:9141`;
  }
  lines.push(outHeader.map((h) => esc(row[h])).join(','));
}

fs.writeFileSync(DST, '\uFEFF' + lines.join('\n'), 'utf8');
const ok = rows.filter((r) => r.easting_kosovaref01).length;
console.log(`Konvertuar: ${ok}/${rows.length} rreshta`);
console.log(`Ruajtur: ${DST}`);
