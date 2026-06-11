/**
 * serve.js — Server lokal Node.js për zhvillim
 *
 * Shërben skedarët statikë (HTML, JS, CSS) nga folderi web/,
 * proxy GeoServer (shmang CORS), pllaka Google/DTK dhe API VGI.
 * Nisja: node serve.js (ose HAPNI.bat) — porti parazgjedhës 5500.
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 5500;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const GEOSERVER = (process.env.GEOSERVER_URL || "http://localhost:8080").replace(/\/$/, "");
const DTK_FILES = "https://dtk.rks-gov.net/files";
const VGI_REPORTS_FILE = path.join(ROOT, "data", "vgi-reports.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Ndihmës: transferon përgjigjen HTTP nga një URL e jashtme te klienti */
function proxyRemote(targetUrl, req, res, errMsg) {
  const lib = targetUrl.startsWith("https") ? https : http;
  const opts = targetUrl.startsWith("https")
    ? { rejectUnauthorized: false }
    : undefined;
  lib
    .get(targetUrl, opts, (up) => {
      res.writeHead(up.statusCode, {
        "Content-Type": up.headers["content-type"] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      });
      up.pipe(res);
    })
    .on("error", () => {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(errMsg);
    });
}

/**
 * Proxy GeoServer — çdo kërkesë /geoserver/... shkon te localhost:8080.
 * Pa këtë, shfletuesi bllokon WMS/WFS për shkak të CORS.
 */
function proxyGeoServer(req, res) {
  proxyRemote(
    GEOSERVER + req.url,
    req,
    res,
    "GeoServer nuk punon. Start Menu -> Start GeoServer, pastaj rifresko faqen."
  );
}

/**
 * Proxy pllakave Google Satellite — shton Referer/User-Agent që të mos kthejë 403.
 * Rruga: /google-tiles/{z}/{x}/{y}?lyrs=s|y
 */
function proxyGoogleTiles(req, res) {
  const pathOnly = req.url.split("?")[0];
  const q = req.url.includes("?") ? req.url.split("?")[1] : "";
  const params = new URLSearchParams(q);
  let x = params.get("x");
  let y = params.get("y");
  let z = params.get("z");
  const pathMatch = pathOnly.match(
    /\/google-tiles\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z]+)?$/i
  );
  if (pathMatch) {
    z = pathMatch[1];
    x = pathMatch[2];
    y = pathMatch[3];
  }
  const s = params.get("s") || "0";

  if (x == null || y == null || z == null) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Parametrat x, y, z mungojne.");
    return;
  }

  const lyrs = params.get("lyrs") === "y" ? "y" : "s";
  const target =
    "https://mt" +
    encodeURIComponent(s) +
    ".google.com/vt/lyrs=" +
    lyrs +
    "&hl=en&x=" +
    encodeURIComponent(x) +
    "&y=" +
    encodeURIComponent(y) +
    "&z=" +
    encodeURIComponent(z);

  https
    .get(
      target,
      {
        rejectUnauthorized: false,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://www.google.com/maps",
          Accept: "image/*,*/*;q=0.8",
        },
      },
      (up) => {
        if (up.statusCode && up.statusCode >= 400) {
          res.writeHead(up.statusCode, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Google tile: " + up.statusCode);
          return;
        }
        res.writeHead(up.statusCode || 200, {
          "Content-Type": up.headers["content-type"] || "image/jpeg",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        });
        up.pipe(res);
      }
    )
    .on("error", () => {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Google Satellite nuk u ngarkua. Kontrollo internetin.");
    });
}

/** Proxy fotove nga dtk.rks-gov.net — shmang bllokimin hotlink në shfletues */
function proxyDtkFiles(req, res) {
  const sub = req.url.replace(/^\/dtk-files/, "");
  proxyRemote(
    DTK_FILES + sub,
    req,
    res,
    "Foto DTK nuk u ngarkua. Kontrollo internetin ose rifresko."
  );
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function extractDtkPhotoPaths(html, heritageId) {
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
  return [...paths].map((p) => "/dtk-files" + p.replace(/^\/files/, ""));
}

function fetchDtkPhotoUrls(heritageId) {
  return new Promise((resolve, reject) => {
    const target =
      "https://dtk.rks-gov.net/Objekti?heritageId=" +
      encodeURIComponent(heritageId);
    https
      .get(
        target,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WebGIS-TKK/1.0)",
            Accept: "text/html",
          },
          rejectUnauthorized: false,
        },
        (up) => {
          if (up.statusCode >= 300 && up.statusCode < 400 && up.headers.location) {
            fetchDtkPhotoUrlsFromUrl(up.headers.location).then(resolve).catch(reject);
            return;
          }
          let body = "";
          up.setEncoding("utf8");
          up.on("data", (c) => (body += c));
          up.on("end", () => {
            if (up.statusCode !== 200) {
              reject(new Error("DTK HTTP " + up.statusCode));
              return;
            }
            resolve(extractDtkPhotoPaths(body, heritageId));
          });
        }
      )
      .on("error", reject)
      .setTimeout(25000, function () {
        this.destroy(new Error("DTK timeout"));
      });
  });
}

function fetchDtkPhotoUrlsFromUrl(target) {
  return new Promise((resolve, reject) => {
    https
      .get(
        target,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WebGIS-TKK/1.0)",
            Accept: "text/html",
          },
          rejectUnauthorized: false,
        },
        (up) => {
          let body = "";
          up.setEncoding("utf8");
          up.on("data", (c) => (body += c));
          up.on("end", () => {
            if (up.statusCode !== 200) {
              reject(new Error("DTK HTTP " + up.statusCode));
              return;
            }
            const id = (target.match(/heritageId=(\d+)/) || [])[1];
            resolve(extractDtkPhotoPaths(body, id));
          });
        }
      )
      .on("error", reject);
  });
}

function readVgiReports() {
  try {
    const raw = fs.readFileSync(VGI_REPORTS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeVgiReports(list) {
  fs.mkdirSync(path.dirname(VGI_REPORTS_FILE), { recursive: true });
  fs.writeFileSync(VGI_REPORTS_FILE, JSON.stringify(list, null, 2), "utf8");
}

/** Kontroll i shpejtë që serveri dhe API-të janë aktivë */
function handleApiHealth(res) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
  res.writeHead(200, cors);
  res.end(
    JSON.stringify({
      ok: true,
      vgi: true,
      googleTiles: true,
      server: "webgis-serve",
    })
  );
}

/**
 * API VGI — raportet e përdoruesit (Volunteered Geographic Information).
 * GET: lexon listën nga data/vgi-reports.json
 * POST: shton raport të ri me lat, lon, përshkrim
 */
function handleVgiReportsApi(req, res) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, cors);
    res.end(JSON.stringify(readVgiReports()));
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const lat = Number(payload.lat);
        const lon = Number(payload.lon);
        const desc = String(payload.description || "").trim();

        if (!desc || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          res.writeHead(400, cors);
          res.end(JSON.stringify({ error: "Të dhënat e raportit janë të paplota." }));
          return;
        }

        const report = {
          id: "VGI-" + Date.now(),
          createdAt: new Date().toISOString(),
          category: String(payload.category || "other"),
          categoryLabel: String(payload.categoryLabel || payload.category || ""),
          description: desc.slice(0, 2000),
          email: payload.email ? String(payload.email).slice(0, 120) : null,
          lat,
          lon,
          monumentId: payload.monumentId || null,
          monumentName: payload.monumentName || null,
        };

        const list = readVgiReports();
        list.push(report);
        try {
          writeVgiReports(list);
        } catch (writeErr) {
          res.writeHead(500, cors);
          res.end(
            JSON.stringify({
              error: writeErr.message || "Skedari vgi-reports.json nuk u shkrua.",
            })
          );
          return;
        }

        res.writeHead(201, cors);
        res.end(JSON.stringify({ ok: true, id: report.id }));
      } catch (err) {
        res.writeHead(400, cors);
        res.end(JSON.stringify({ error: err.message || "JSON i pavlefshëm" }));
      }
    });
    return;
  }

  res.writeHead(405, cors);
  res.end(JSON.stringify({ error: "Metoda nuk lejohet" }));
}

/** API DTK — nxjerr URL-të e fotove nga faqja e objektit (heritageId) */
function handleDtkPhotosApi(req, res) {
  const q = req.url.includes("?") ? req.url.split("?")[1] : "";
  const heritageId = new URLSearchParams(q).get("heritageId");
  if (!heritageId || !/^\d+$/.test(heritageId)) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "heritageId mungon ose është i pavlefshëm" }));
    return;
  }

  fetchDtkPhotoUrls(heritageId)
    .then((urls) => {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(JSON.stringify({ heritageId, urls }));
    })
    .catch((err) => {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message || "DTK gabim" }));
    });
}

/** Router kryesor — API, proxy, pastaj skedarë statikë nga folderi web/ */
const server = http.createServer((req, res) => {
  const pathOnly = req.url.split("?")[0];

  if (pathOnly === "/api/health") {
    handleApiHealth(res);
    return;
  }

  if (req.url.startsWith("/geoserver")) {
    proxyGeoServer(req, res);
    return;
  }

  if (req.url.startsWith("/dtk-files")) {
    proxyDtkFiles(req, res);
    return;
  }

  if (req.url.startsWith("/google-tiles")) {
    proxyGoogleTiles(req, res);
    return;
  }

  if (req.url.startsWith("/api/dtk-photos")) {
    handleDtkPhotosApi(req, res);
    return;
  }

  if (req.url.startsWith("/api/vgi-reports")) {
    handleVgiReportsApi(req, res);
    return;
  }

  /** Shërbimi i skedarëve statikë (index.html, js, css, data, …) */
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("404 — " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (ext === ".js" || ext === ".html" || ext === ".css") {
      headers["Cache-Control"] = "no-cache";
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      "\nPorti " +
        PORT +
        " eshte i zene (Live Server / server tjeter).\n" +
        "Mbyll atë dritare, pastaj: node serve.js\n"
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

function getLanIpv4Urls(port) {
  const urls = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        urls.push("http://" + iface.address + ":" + port);
      }
    }
  }
  return urls;
}

server.listen(PORT, HOST, () => {
  console.log("Faqja (PC):      http://localhost:" + PORT);
  const lan = getLanIpv4Urls(PORT);
  if (lan.length) {
    console.log("Faqja (telefon): " + lan.join("  ose  "));
    console.log("  (Wi-Fi i njejte me PC; mos perdor localhost ne telefon)");
  } else {
    console.log("Faqja (telefon): gjej IP me ipconfig, pastaj http://IP:" + PORT);
  }
  console.log("Proxy:  http://localhost:" + PORT + "/geoserver/...");
  console.log("DTK:    http://localhost:" + PORT + "/dtk-files/...");
  console.log("Google: http://localhost:" + PORT + "/google-tiles/...");
  console.log("VGI:    http://localhost:" + PORT + "/api/vgi-reports");
  console.log("Health: http://localhost:" + PORT + "/api/health");
  console.log("GeoServer duhet ON (localhost:8080)");
  if (process.platform === "win32") {
    console.log(
      "Nuk hapet ne telefon? Ekzekuto LEJO-TELEFON.bat si Administrator (firewall)."
    );
  }
});
