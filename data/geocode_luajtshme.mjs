/**
 * Geokodon objektet e luajtshme (pa lat/lon në DTK) nga komuna + vendi në përshkrim.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'sites_luajtshme.csv');

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

function placeQuery(row) {
  const t = `${row.emri} ${row.pershkrim_i_shkurter} ${row.shenime}`;
  const places = [
    'Begracë', 'Begrace', 'Kaçanik', 'Kacanik', 'Klinë', 'Kline', 'Viti', 'Pejë', 'Peje',
    'Skënderaj', 'Skenderaj', 'Prizren', 'Prishtinë', 'Prishtine', 'Gjakovë', 'Gjakove',
    'Ferizaj', 'Mitrovicë', 'Mitrovice', 'Drenicë', 'Drenice', 'Medvegje', 'Rahovec',
  ];
  for (const p of places) {
    if (t.toLowerCase().includes(p.toLowerCase().replace('ë', 'e'))) {
      return `${p}, Kosovo`;
    }
  }
  if (row.komuna && row.komuna !== 'N.A.') return `${row.komuna}, Kosovo`;
  return 'Prishtinë, Kosovo';
}

async function nom(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const j = await (await fetch(url, { headers: { 'User-Agent': 'webgis-kosove-tkk/1.0' } })).json();
  if (!j[0]) return null;
  return { lat: j[0].lat, lon: j[0].lon, burim: `OSM Nominatim: ${q}` };
}

const { header, rows } = parseCsv(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''));
let n = 0;
for (const r of rows) {
  if (r.lat && r.lon) continue;
  const q = placeQuery(r);
  const c = await nom(q);
  if (c) {
    r.lat = c.lat;
    r.lon = c.lon;
    r.koordinata_burimi = c.burim;
    r.saktesia_koordinates = 'e perafert';
    n++;
    console.log('OK', r.id, q, c.lat, c.lon);
  } else {
    console.log('MISS', r.id, q);
  }
  await new Promise((res) => setTimeout(res, 1100));
}

const lines = [header.join(',')];
for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
fs.writeFileSync(FILE, '\uFEFF' + lines.join('\n'), 'utf8');
console.log(`Geokoduar: ${n}/${rows.length}`);
