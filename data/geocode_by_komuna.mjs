/**
 * Plotëson lat/lon për rreshta pa koordinata — qendra e komunës (përafërt).
 * node geocode_by_komuna.mjs sites_arkitekturore.csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const cache = new Map();

async function komunaCenter(komuna) {
  const k = komuna || 'Prishtinë';
  if (cache.has(k)) return cache.get(k);
  const q = `${k}, Kosovo`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const j = await (await fetch(url, { headers: { 'User-Agent': 'webgis-kosove-tkk/1.0' } })).json();
  const c = j[0]
    ? { lat: j[0].lat, lon: j[0].lon, burim: `OSM qendra e komunës: ${k}` }
    : null;
  cache.set(k, c);
  await new Promise((r) => setTimeout(r, 1100));
  return c;
}

const { header, rows } = parseCsv(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''));
let n = 0;
const need = rows.filter((r) => !r.lat || !r.lon);
console.log(`Pa koordinata: ${need.length}/${rows.length}`);

for (const r of need) {
  const c = await komunaCenter(r.komuna === 'N.A.' ? 'Prishtinë' : r.komuna);
  if (c) {
    r.lat = c.lat;
    r.lon = c.lon;
    r.koordinata_burimi = c.burim;
    r.saktesia_koordinates = 'e perafert (qendra komunës)';
    n++;
    console.log('OK', r.id, r.komuna);
  }
}

const lines = [header.join(',')];
for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
fs.writeFileSync(FILE, '\uFEFF' + lines.join('\n'), 'utf8');
console.log(`Plotësuar: ${n}`);
