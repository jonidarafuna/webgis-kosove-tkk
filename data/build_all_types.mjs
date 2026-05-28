/**
 * Hapi 2 — mbledh të gjitha monumentet nga DTK (3 lloje trashëgimie, Kosovë).
 * Përdorim: node build_all_types.mjs
 */
import { writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://dtk.rks-gov.net';

const TYPES = [
  { tipi: 'Arkeologjike', lloji: 'arkeologjike', prefix: 'ARK', out: 'sites_arkeologjike.csv' },
  { tipi: 'Arkitekturale', lloji: 'arkitekturore', prefix: 'ARH', out: 'sites_arkitekturore.csv' },
  { tipi: 'Luajtshme', lloji: 'luajtshme', prefix: 'LUA', out: 'sites_luajtshme.csv' },
];

function decodeHtml(s) {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? decodeHtml(m[group]).trim() : '';
}

function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function mapPeriudha(p) {
  const x = norm(p);
  if (!x) return 'i panjohur';
  if (x.includes('neolit')) return 'neolit';
  if (x.includes('eneolit') || x.includes('bakrit')) return 'eneolit';
  if (x.includes('bronz')) return 'bronz';
  if (x.includes('hekur')) return 'hekur';
  if (x.includes('helen')) return 'helenistik';
  if (x.includes('romak')) return 'romak';
  if (x.includes('antikitet')) return 'antikitet_i_vone';
  if (x.includes('mesjet')) return 'mesjetar';
  if (x.includes('osman')) return 'osman';
  if (x.includes('moder')) return 'moderne';
  if (x.includes('bashkekohor')) return 'bashkekohor';
  return p || 'i panjohur';
}

function kategoria(emri, klasa, lloji) {
  const t = `${emri} ${klasa}`.toLowerCase();
  if (lloji === 'arkeologjike') {
    if (/nekropoli|tum|varrez/.test(t)) return 'nekropoli';
    if (/kalaj|fortes|fortifik|gradis|keshtjell|hisar/.test(t)) return 'fortifikate_kalaje';
    if (/vilae|term|banjo/.test(t)) return 'gjurme_rrnoje';
    if (/vendbanim|lokalitet|qytez|municipium|ulpi/.test(t)) return 'vendbanim';
    if (/grop/.test(t)) return 'grope';
    return 'lokalitet_arkeologjik';
  }
  if (lloji === 'arkitekturore') {
    if (/xhami|mesxhid|teq/.test(t)) return 'objekt_fetar';
    if (/kull|kulla/.test(t)) return 'kulla';
    if (/kish|manastir/.test(t)) return 'objekt_fetar';
    if (/hamam|carxhi|han |banes/.test(t)) return 'objekt_urban';
    if (/monument|memorial/.test(t)) return 'monument';
    if (/ur[aë]|urë/.test(t)) return 'ure';
    return 'monument_arkitekture';
  }
  // luajtshme
  if (/muze|muzeu/.test(t)) return 'muze';
  if (/koleksion|kolekcion/.test(t)) return 'koleksion';
  return 'objekt_luajtshme';
}

function statusFromHtml(html) {
  const h = html.toLowerCase();
  if (h.includes('përhershme') || h.includes('perhershme')) return 'mbrojtje e perhershme';
  if (h.includes('përkohshme') || h.includes('perkohshme')) return 'mbrojtje e perkohshme';
  return 'e pa percaktuar';
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function listIds(tipi) {
  const ids = new Set();
  for (let page = 1; page <= 40; page++) {
    const html = await fetchText(`${BASE}/Trashegimia?tipi=${tipi}&currentPage=${page}`);
    const re = /heritageId=(\d+)/g;
    let m;
    let n = 0;
    while ((m = re.exec(html)) !== null) {
      ids.add(m[1]);
      n++;
    }
    if (n === 0) break;
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

async function scrapeType({ tipi, lloji, prefix, out }) {
  const ids = await listIds(tipi);
  console.log(`\n=== ${lloji}: ${ids.length} objekte ===`);

  const rows = [];
  let i = 0;
  for (const hid of ids) {
    i++;
    await new Promise((r) => setTimeout(r, 120));
    const html = await fetchText(`${BASE}/Objekti?heritageId=${hid}`);

    const emri = pick(/<h1 class=" c_blue">([^<]+)<\/h1>/i, html) || pick(/<h1[^>]*>([^<]+)<\/h1>/i, html);
    const periudhaDetaj = pick(/Periudha:\s*<\/span>\s*([^<]+)/i, html);
    const klasa = pick(/Klasa:\s*<\/span>\s*([^<]+)/i, html);
    const komuna = pick(/Komuna:\s*<\/span>\s*([^<]+)/i, html);
    const lat = pick(/ObjectItemDetails_Latituda[^>]+value="([^"]+)"/i, html);
    const lon = pick(/ObjectItemDetails_Longituda[^>]+value="([^"]+)"/i, html);
    let pershkrim = pick(/Historiku<\/h1>\s*<br\s*\/?>\s*<p>\s*([\s\S]*?)<\/p>/i, html);
    pershkrim = pershkrim.replace(/\s+/g, ' ').trim();
    if (pershkrim.length > 220) pershkrim = pershkrim.slice(0, 220) + '...';

    rows.push({
      heritageId: hid,
      emri,
      lloji_trashegimise: lloji,
      kategoria: kategoria(emri, klasa, lloji),
      periudha: mapPeriudha(periudhaDetaj),
      periudha_detaj: periudhaDetaj,
      komuna,
      rajon: 'Kosove',
      lat,
      lon,
      koordinata_burimi: lat && lon ? 'DTK' : 'DTK (pa koordinatë në faqe)',
      saktesia_koordinates: lat && lon ? 'e mire' : 'mungon',
      gjendja: 'e mire',
      status_mbrojtjes: statusFromHtml(html),
      pershkrim_i_shkurter: pershkrim,
      burimi: 'DTK',
      url_dtk: `${BASE}/Objekti?heritageId=${hid}`,
      verifikuar: 'po',
      shenime: `klasa=${klasa}; heritageId=${hid}`,
    });
    console.log(`  ${i}/${ids.length} ${hid} ${komuna || '?'} ${lat ? 'OK' : 'NO-COORD'}`);
  }

  rows.sort((a, b) => a.komuna.localeCompare(b.komuna) || a.emri.localeCompare(b.emri));

  const header = [
    'id', 'emri', 'lloji_trashegimise', 'kategoria', 'periudha', 'periudha_detaj', 'komuna', 'rajon',
    'lat', 'lon', 'koordinata_burimi', 'saktesia_koordinates', 'gjendja', 'status_mbrojtjes',
    'pershkrim_i_shkurter', 'burimi', 'url_dtk', 'verifikuar', 'shenime',
  ];

  const lines = [header.join(',')];
  rows.forEach((r, idx) => {
    const line = { id: `${prefix}-${String(idx + 1).padStart(3, '0')}`, ...r };
    lines.push(header.map((k) => csvEscape(line[k])).join(','));
  });

  const outPath = join(__dirname, out);
  writeFileSync(outPath, '\uFEFF' + lines.join('\n'), 'utf8');
  const noCoord = rows.filter((r) => !r.lat || !r.lon).length;
  console.log(`Ruajtur: ${outPath} (${rows.length} rreshta, ${noCoord} pa koordinata)`);
  return { lloji, rows, noCoord };
}

async function mergeAll(results) {
  const header = [
    'id', 'emri', 'lloji_trashegimise', 'kategoria', 'periudha', 'periudha_detaj', 'komuna', 'rajon',
    'lat', 'lon', 'koordinata_burimi', 'saktesia_koordinates', 'gjendja', 'status_mbrojtjes',
    'pershkrim_i_shkurter', 'burimi', 'url_dtk', 'verifikuar', 'shenime',
  ];
  const all = [];
  for (const { rows } of results) all.push(...rows);
  all.sort(
    (a, b) =>
      a.lloji_trashegimise.localeCompare(b.lloji_trashegimise) ||
      a.komuna.localeCompare(b.komuna) ||
      a.emri.localeCompare(b.emri),
  );

  const lines = [header.join(',')];
  all.forEach((r, idx) => {
    const line = { id: `XK-${String(idx + 1).padStart(3, '0')}`, ...r };
    lines.push(header.map((k) => csvEscape(line[k])).join(','));
  });

  console.log(`\nScrape: ${all.length} rreshta gjithsej`);
  spawnSync('node', ['build_three_csv.mjs'], { cwd: __dirname, stdio: 'inherit' });
}

async function main() {
  const results = [];
  for (const t of TYPES) {
    results.push(await scrapeType(t));
  }
  await mergeAll(results);

  const summary = results
    .map((r) => `${r.lloji}=${r.rows.length} (pa koord: ${r.noCoord})`)
    .join('\n');
  writeFileSync(join(__dirname, 'scrape_meta.txt'), summary + '\n', 'utf8');
  console.log('\n' + summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
