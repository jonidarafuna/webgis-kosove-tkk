/**
 * Kontrollon që faqja të hapet përmes node serve.js, jo me dy-klik mbi index.html.
 */
(function () {
  const PROTO = window.location.protocol;
  const IS_FILE = PROTO === "file:";

  window.TKK_APP_MODE = IS_FILE ? "file" : "http";

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

  function showOverlay(kind, detail) {
    const el = document.getElementById("tkkServerOverlay");
    if (!el) return;
    el.innerHTML = overlayHtml(kind || "file", detail);
    el.hidden = false;
    document.body.classList.add("tkk-server-overlay-active");
    window.TKK_SERVER_OVERLAY_OPEN = true;
  }

  function hideOverlay() {
    const el = document.getElementById("tkkServerOverlay");
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("tkk-server-overlay-active");
    window.TKK_SERVER_OVERLAY_OPEN = false;
  }

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

  function runHttpChecks() {
    checkNodeServe().then(function (ok) {
      if (!ok) {
        showOverlay("wrongServer");
        return;
      }
      checkGeoServerProxy();
    });
  }

  window.tkkOnMonumentsLoaded = function (count) {
    if (count > 0 && !IS_FILE) {
      hideOverlay();
    } else if (count === 0) {
      showOverlay("noData");
    }
  };

  window.tkkOnMonumentsLoadError = function (err) {
    showOverlay("wfsError", err && err.message ? err.message : "");
  };

  window.showTkkDataOverlay = showOverlay;
  window.hideTkkDataOverlay = hideOverlay;

  if (IS_FILE) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        showOverlay("file");
      });
    } else {
      showOverlay("file");
    }
  } else {
    document.addEventListener("DOMContentLoaded", runHttpChecks);
  }
})();
