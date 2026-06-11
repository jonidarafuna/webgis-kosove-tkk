/**
 * QËLLIMI: Kontrollon mënyrën e hapjes së aplikacionit (file:// vs http://) dhe shfaq
 *           mesazhe ndihmëse kur serveri, GeoServer-i ose të dhënat mungojnë.
 * KUR NGARKOHET: Menjëherë kur skedari lexohet (para DOMContentLoaded për file://).
 * LIDHET ME: serve.js (/api/health, proxy GeoServer), index.html (#tkkServerOverlay),
 *             map.js (tkkOnMonumentsLoaded, tkkOnMonumentsLoadError), i18n.js (tkkLang).
 */
(function () {
  const PROTO = window.location.protocol;
  const IS_FILE = PROTO === "file:";

  window.TKK_APP_MODE = IS_FILE ? "file" : "http";

  /** Kthen HTML për overlay-in e gabimit (shqip ose anglisht sipas tkkLang). */
  function overlayHtml(kind, detail) {
    const lang = localStorage.getItem("tkkLang") === "en" ? "en" : "sq";

    if (kind === "wrongServer") {
      if (lang === "en") {
        return (
          '<div class="tkk-server-overlay__box">' +
          "<h2>Wrong server on port 5500</h2>" +
          "<p>Monuments and polygons need <code>node serve.js</code> (GeoServer proxy). Live Server / VS Code preview does not work.</p>" +
          "<ol>" +
          "<li>Close other servers on port 5500</li>" +
          "<li>Double-click <strong>HAPNI.bat</strong> in the <strong>web</strong> folder</li>" +
          "<li>Open <a href=\"http://localhost:5500\">http://localhost:5500</a> and press Ctrl+F5</li>" +
          "</ol></div>"
        );
      }
      return (
        '<div class="tkk-server-overlay__box">' +
        "<h2>Serveri i gabuar në portin 5500</h2>" +
        "<p>Monumentet dhe poligonet kërkojnë <code>node serve.js</code> (proxy GeoServer). Live Server / preview nga VS Code nuk funksionon.</p>" +
        "<ol>" +
        "<li>Mbyll çdo server tjetër në portin 5500</li>" +
        "<li>Dy-klik <strong>HAPNI.bat</strong> në folderin <strong>web</strong></li>" +
        "<li>Hap <a href=\"http://localhost:5500\">http://localhost:5500</a> dhe shtyp Ctrl+F5</li>" +
        "</ol></div>"
      );
    }

    if (kind === "noData") {
      if (lang === "en") {
        return (
          '<div class="tkk-server-overlay__box">' +
          "<h2>No map data loaded</h2>" +
          "<p>0 monuments from GeoServer. Check that GeoServer is running and layers are published.</p>" +
          "<ol>" +
          "<li>Start <strong>GeoServer</strong> (Start Menu)</li>" +
          "<li>Restart <strong>HAPNI.bat</strong></li>" +
          "<li>Refresh with Ctrl+F5</li>" +
          "</ol></div>"
        );
      }
      return (
        '<div class="tkk-server-overlay__box">' +
        "<h2>Të dhënat nuk u ngarkuan</h2>" +
        "<p>0 monumente nga GeoServer. Kontrollo që GeoServer është ON dhe shtresat janë publikuar.</p>" +
        "<ol>" +
        "<li>Nis <strong>GeoServer</strong> (Start Menu)</li>" +
        "<li>Rinis <strong>HAPNI.bat</strong></li>" +
        "<li>Rifresko me Ctrl+F5</li>" +
        "</ol></div>"
      );
    }

    if (kind === "staticMissing") {
      if (lang === "en") {
        return (
          '<div class="tkk-server-overlay__box">' +
          "<h2>Monument data not published yet</h2>" +
          "<p>On your PC: start GeoServer and <strong>HAPNI.bat</strong>, then run <strong>EKSPORTO-MONUMENTE.bat</strong> in the web folder. Push the GeoJSON files to GitHub.</p></div>"
        );
      }
      return (
        '<div class="tkk-server-overlay__box">' +
        "<h2>Të dhënat e monumenteve nuk janë publikuar</h2>" +
        "<p>Në PC: nis GeoServer dhe <strong>HAPNI.bat</strong>, pastaj dy-klik <strong>EKSPORTO-MONUMENTE.bat</strong> në folderin web. Bëj push skedarët GeoJSON në GitHub.</p></div>"
      );
    }

    if (kind === "wfsError") {
      const msg = detail ? "<p><code>" + String(detail) + "</code></p>" : "";
      if (lang === "en") {
        return (
          '<div class="tkk-server-overlay__box">' +
          "<h2>WFS error</h2>" +
          msg +
          "<p>Use <strong>HAPNI.bat</strong> and a running GeoServer, then Ctrl+F5.</p></div>"
        );
      }
      return (
        '<div class="tkk-server-overlay__box">' +
        "<h2>Gabim WFS</h2>" +
        msg +
        "<p>Përdor <strong>HAPNI.bat</strong> dhe GeoServer ON, pastaj Ctrl+F5.</p></div>"
      );
    }

    if (lang === "en") {
      return (
        '<div class="tkk-server-overlay__box">' +
        "<h2>Do not open index.html with double-click</h2>" +
        "<p>Polygons and monument points load from GeoServer through the local server (<code>serve.js</code>). Opening the file directly does not work.</p>" +
        "<ol>" +
        "<li>Start <strong>GeoServer</strong> (Start Menu → Start GeoServer)</li>" +
        "<li>In terminal, go to the <strong>web</strong> folder and run: <code>node serve.js</code></li>" +
        "<li>Open in the browser: <a href=\"http://localhost:5500\">http://localhost:5500</a></li>" +
        "</ol>" +
        '<p class="tkk-server-overlay__hint">Or double-click <strong>HAPNI.bat</strong> in the web folder (Windows).</p>' +
        "</div>"
      );
    }
    return (
      '<div class="tkk-server-overlay__box">' +
      "<h2>Mos hap index.html me dy-klik</h2>" +
      "<p>Poligonet dhe pikat e monumenteve ngarkohen nga GeoServer përmes serverit lokal (<code>serve.js</code>). Hapja direkte e skedarit nuk funksionon.</p>" +
      "<ol>" +
      "<li>Nis <strong>GeoServer</strong> (Start Menu → Start GeoServer)</li>" +
      "<li>Në terminal, shko te folderi <strong>web</strong> dhe shkruaj: <code>node serve.js</code></li>" +
      "<li>Hap në shfletues: <a href=\"http://localhost:5500\">http://localhost:5500</a></li>" +
      "</ol>" +
      '<p class="tkk-server-overlay__hint">Ose dy-klik <strong>HAPNI.bat</strong> në folderin web (Windows).</p>' +
      "</div>"
    );
  }

  /** Shfaq panelin e plotë mbi hartë me udhëzime për përdoruesin. */
  function showOverlay(kind, detail) {
    const el = document.getElementById("tkkServerOverlay");
    if (!el) return;
    el.innerHTML = overlayHtml(kind || "file", detail);
    el.hidden = false;
    document.body.classList.add("tkk-server-overlay-active");
    window.TKK_SERVER_OVERLAY_OPEN = true;
  }

  /** Fsheh overlay-in kur të dhënat janë ngarkuar me sukses. */
  function hideOverlay() {
    const el = document.getElementById("tkkServerOverlay");
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("tkk-server-overlay-active");
    window.TKK_SERVER_OVERLAY_OPEN = false;
  }

  /** Teston nëse proxy-ja WFS e GeoServer-it përgjigjet si XML i vlefshëm. */
  function checkGeoServerProxy() {
    const testUrl =
      window.location.origin +
      "/geoserver/tkk/wfs?service=WFS&version=1.0.0&request=GetCapabilities";

    return fetch(testUrl, { method: "GET", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) {
          showOverlay("file");
          return false;
        }
        return r.text().then(function (body) {
          if (body.trim().startsWith("<")) return true;
          showOverlay("file");
          return false;
        });
      })
      .catch(function () {
        showOverlay("file");
        return false;
      });
  }

  /** Kontrollon nëse po xhiron serve.js (endpoint /api/health). */
  function checkNodeServe() {
    return fetch(window.location.origin + "/api/health", {
      cache: "no-store",
    })
      .then(function (r) {
        const ct = r.headers.get("content-type") || "";
        return r.ok && ct.includes("application/json");
      })
      .catch(function () {
        return false;
      });
  }

  /** Nis kontrollet e serverit vetëm në modalitetin http (jo publikim statik). */
  function runHttpChecks() {
    if (window.tkkIsStaticPublish) return;
    checkNodeServe().then(function (ok) {
      window.TKK_NODE_SERVE_OK = ok;
      if (!ok) {
        return;
      }
      checkGeoServerProxy();
    });
  }

  /** Thirret nga map.js kur monumentet përfundojnë ngarkimin — fsheh ose tregon overlay. */
  window.tkkOnMonumentsLoaded = function (count) {
    if (count > 0 && !IS_FILE) {
      hideOverlay();
      return;
    }
    if (count === 0 && !IS_FILE) {
      if (window.tkkIsStaticPublish) {
        showOverlay("staticMissing");
      } else if (window.TKK_NODE_SERVE_OK === false) {
        showOverlay("wrongServer");
      } else {
        showOverlay("noData");
      }
    }
  };

  /** Thirret kur ngarkimi WFS dështon — shfaq gabimin WFS në overlay. */
  window.tkkOnMonumentsLoadError = function (err) {
    showOverlay("wfsError", err && err.message ? err.message : "");
  };

  window.showTkkDataOverlay = showOverlay;
  window.hideTkkDataOverlay = hideOverlay;

  // ——— Hapja e faqes: file:// vs http:// ———
  if (IS_FILE) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        showOverlay("file");
      });
    } else {
      showOverlay("file");
    }
  } else if (!window.tkkIsStaticPublish) {
    document.addEventListener("DOMContentLoaded", runHttpChecks);
  }
})();
