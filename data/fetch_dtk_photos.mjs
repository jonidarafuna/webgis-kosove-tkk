/**
 * Merr URL-të e fotove nga dtk.rks-gov.net për çdo monument në CSV.
 * node data/fetch_dtk_photos.mjs
 * node data/fetch_dtk_photos.mjs --limit 20   (test)
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DTK = "https://dtk.rks-gov.net";
const CSV_FILES = [
  "sites_arkeologjike.csv",
  "sites_arkitekturore.csv",
  "sites_luajtshme.csv",
];
const OUT = path.join(ROOT, "web", "data", "photos.json");
const DELAY_MS = 350;

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] || process.argv[process.argv.indexOf("--limit") + 1], 10) : 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCsvLine(line) {
  const out = [];
  let i = 0;
  let field = "";
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i++];
        }
      }
      out.push(field);
      field = "";
      if (line[i] === ",") i++;
    } else {
      while (i < line.length && line[i] !== ",") field += line[i++];
      out.push(field);
      field = "";
      if (line[i] === ",") i++;
    }
  }
  return out;
}

function loadSites() {
  const sites = [];
  for (const file of CSV_FILES) {
    const text = fs.readFileSync(path.join(__dirname, file), "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines[0].replace(/^\uFEFF/, ""));
    const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    for (let n = 1; n < lines.length; n++) {
      const cols = parseCsvLine(lines[n]);
      const row = {};
      header.forEach((h, i) => {
        row[h.trim()] = cols[i] ?? "";
      });
      const id = row.id;
      const url = row.url_dtk || "";
      let heritageId = (url.match(/heritageId=(\d+)/) || [])[1];
      if (!heritageId) {
        heritageId = ((row.shenime || "").match(/heritageId=(\d+)/) || [])[1];
      }
      if (id && heritageId) sites.push({ id, heritageId, emri: row.emri });
    }
  }
  return sites;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function extractPhotoPaths(html, heritageId) {
  const start = html.indexOf('class="heritage-photo-gallery"');
  let scope = html;
  if (start !== -1) {
    const end = html.indexOf('<h1 class=" c_blue">Statusi', start);
    scope = end > start ? html.slice(start, end) : html.slice(start, start + 12000);
  }
  const prefix = heritageId ? `/files/${heritageId}/` : "/files/";
  const paths = new Set();
  const re = /<img[^>]+src="(\/files\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(scope)) !== null) {
    let src = decodeHtmlEntities(m[1]);
    try {
      src = decodeURIComponent(src);
    } catch {
      /* ignore */
    }
    if (!src.startsWith(prefix)) continue;
    if (!/\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(src)) continue;
    paths.add(src);
  }
  return [...paths];
}

function toProxyUrl(filePath) {
  return "/dtk-files" + filePath.replace(/^\/files/, "");
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WebGIS-TKK/1.0; academic)",
          Accept: "text/html",
        },
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) reject(new Error("HTTP " + res.statusCode));
          else resolve(body);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function fetchPhotosForHeritage(heritageId) {
  const url = `${DTK}/Objekti?heritageId=${heritageId}`;
  const html = await httpsGet(url);
  const paths = extractPhotoPaths(html, heritageId);
  return paths.map(toProxyUrl);
}

async function main() {
  let sites = loadSites();
  if (LIMIT > 0) sites = sites.slice(0, LIMIT);

  console.log("Monumente për skanim:", sites.length);

  const photos = {
    _info:
      "Gjeneruar nga data/fetch_dtk_photos.mjs — URL përmes proxy /dtk-files/ në serve.js",
    _updated: new Date().toISOString(),
  };

  let ok = 0;
  let empty = 0;
  let fail = 0;

  for (let i = 0; i < sites.length; i++) {
    const { id, heritageId, emri } = sites[i];
    process.stdout.write(`[${i + 1}/${sites.length}] ${id} … `);
    try {
      const urls = await fetchPhotosForHeritage(heritageId);
      if (urls.length) {
        photos[id] = urls;
        ok++;
        console.log(urls.length + " foto");
      } else {
        empty++;
        console.log("pa foto");
      }
    } catch (e) {
      fail++;
      console.log("gabim:", e.message);
    }
    if (i < sites.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(photos, null, 2), "utf8");
  console.log("\nRuajtur:", OUT);
  console.log("Me foto:", ok, "| Pa foto:", empty, "| Gabime:", fail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
