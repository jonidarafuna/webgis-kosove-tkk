/**
 * 3 CSV (arkeologjike, arkitekturore, luajtshme) me WGS84 + KosovaRef01.
 * node build_three_csv.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const proj4 = require('./proj4.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs(
  'EPSG:9141',
  '+proj=tmerc +lat_0=0 +lon_0=21 +k=0.9999 +x_0=7500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
);

const TYPES = [
  { lloji: 'arkeologjike', file: 'sites_arkeologjike.csv', prefix: 'ARK' },
  { lloji: 'arkitekturore', file: 'sites_arkitekturore.csv', prefix: 'ARH' },
  { lloji: 'luajtshme', file: 'sites_luajtshme.csv', prefix: 'LUA' },
];

const HEADER = [
  'id',
  'emri',
  'lloji_trashegimise',
  'kategoria',
  'periudha',
  'periudha_detaj',
  'komuna',
  'rajon',
  'lat',
  'lon',
  'easting_kosovaref01',
  'northing_kosovaref01',
  'sistemi_projeksion',
  'koordinata_burimi',
  'saktesia_koordinates',
  'gjendja',
  'status_mbrojtjes',
  'pershkrim_i_shkurter',
  'burimi',
  'url_dtk',
  'verifikuar',
  'shenime',
];

const SPELLING = [
  [/Kosove\b/g, 'Kosovë'],
  [/e mire\b/g, 'e mirë'],
  [/e perafert\b/g, 'e përafërt'],
  [/e pa percaktuar\b/g, 'e pa përcaktuar'],
  [/mbrojtje e perhershme\b/g, 'mbrojtje e përhershme'],
  [/mbrojtje e perkohshme\b/g, 'mbrojtje e përkohshme'],
];

function spell(t) {
  let x = String(t ?? '');
  for (const [re, rep] of SPELLING) x = x.replace(re, rep);
  return x;
}

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
        } else field += text[i++];
      }
      if (text[i] === ',') i++;
      return field;
    }
    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') field += text[i++];
    if (text[i] === ',') i++;
    return field;
  };
  const header = [];
  while (i < len && text[i] !== '\n' && text[i] !== '\r') header.push(readField());
  if (text[i] === '\r') i++;
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
  return rows;
}

function esc(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function convert(lon, lat) {
  const lo = parseFloat(String(lon).replace(',', '.'));
  const la = parseFloat(String(lat).replace(',', '.'));
  if (!Number.isFinite(lo) || !Number.isFinite(la)) return { e: '', n: '', s: '' };
  const [e, n] = proj4('EPSG:4326', 'EPSG:9141', [lo, la]);
  return {
    e: e.toFixed(3),
    n: n.toFixed(3),
    s: 'EPSG:9141 (KOSOVAREF01 / Balkans zone 7)',
  };
}

function enrich(row, lloji) {
  for (const k of Object.keys(row)) row[k] = spell(row[k]);
  row.lloji_trashegimise = lloji;
  if (row.rajon) row.rajon = 'Kosovë';
  const { e, n, s } = convert(row.lon, row.lat);
  row.easting_kosovaref01 = e;
  row.northing_kosovaref01 = n;
  row.sistemi_projeksion = s;
  return row;
}

function pick(row, id) {
  const out = { id };
  for (const h of HEADER) {
    if (h === 'id') continue;
    out[h] = row[h] ?? '';
  }
  return out;
}

function writeType({ lloji, file, prefix }, rows) {
  const sorted = [...rows].sort(
    (a, b) =>
      (a.komuna || '').localeCompare(b.komuna || '') ||
      (a.emri || '').localeCompare(b.emri || ''),
  );
  const lines = [
    HEADER.join(','),
    ...sorted.map((r, i) => {
      const line = pick(enrich({ ...r }, lloji), `${prefix}-${String(i + 1).padStart(3, '0')}`);
      return HEADER.map((h) => esc(line[h])).join(',');
    }),
  ];
  const fp = path.join(__dirname, file);
  fs.writeFileSync(fp, '\uFEFF' + lines.join('\n'), 'utf8');
  const k = sorted.filter((r) => r.lat && r.lon).length;
  console.log(`${file}: ${sorted.length} rreshta, ${k} me WGS84`);
}

let all = [];
for (const f of TYPES.map((t) => t.file)) {
  const fp = path.join(__dirname, f);
  if (!fs.existsSync(fp)) {
    console.error('Mungon:', f);
    process.exit(1);
  }
  all.push(...parseCsv(fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '')));
}

for (const t of TYPES) {
  const rows = all.filter((r) => (r.lloji_trashegimise || '').toLowerCase() === t.lloji);
  if (!rows.length) {
    console.error('Asnjë rresht për', t.lloji);
    process.exit(1);
  }
  writeType(t, rows);
}
