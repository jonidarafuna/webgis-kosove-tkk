/**
 * SKEDARI: coords.js
 * QËLLIMI: Shfaq koordinatat e kursorit në WGS84 ose KOSOVAREF01 (EPSG:9141).
 * KUR NGARKOHET: Pas settings.js, para symbology.js (index.html); ekzekutohet menjëherë (IIFE).
 * LIDHET ME: proj4 (bibliotekë), map.js (lastMapLatLng), index.html (#coordSystemSelect, #mapCoords).
 *
 * Shfaqja e koordinatave: WGS84 ose KOSOVAREF01 (EPSG:9141).
 */
(function () {
  // Çelësi i localStorage për sistemin e koordinatave të zgjedhur
  const STORAGE_KEY = "tkkCoordSystem";

  /** Regjistron projeksionet WGS84 dhe KOSOVAREF01 në proj4. */
  function initProj() {
    if (typeof proj4 === "undefined") return false;
    proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
    proj4.defs(
      "EPSG:9141",
      "+proj=tmerc +lat_0=0 +lon_0=21 +k=0.9999 +x_0=7500000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs"
    );
    return true;
  }

  let projReady = initProj();

  /** Lexon sistemin e zgjedhur: wgs84 ose kref (KOSOVAREF01). */
  function getCoordSystem() {
    const sel = document.getElementById("coordSystemSelect");
    return sel && sel.value === "kref" ? "kref" : "wgs84";
  }

  /** Formato koordinatat sipas sistemit (gradë ose metra). */
  function formatLatLngWithSystem(latlng, system) {
    if (!latlng) return "";
    const useKref = system === "kref";
    if (useKref) {
      if (!projReady) projReady = initProj();
      if (projReady) {
        const p = proj4("EPSG:4326", "EPSG:9141", [latlng.lng, latlng.lat]);
        return "Y " + p[0].toFixed(2) + " · X " + p[1].toFixed(2);
      }
    }
    return "φ " + latlng.lat.toFixed(5) + " · λ " + latlng.lng.toFixed(5);
  }

  /** Formato koordinatat me sistemin aktual të zgjedhur. */
  function formatLatLng(latlng) {
    return formatLatLngWithSystem(latlng, getCoordSystem());
  }

  /** Përditëson shfaqjen e koordinatave poshtë hartës. */
  function refreshCoordDisplay() {
    const el = document.getElementById("mapCoords");
    if (!el) return;
    if (window.lastMapLatLng) {
      el.textContent = formatLatLng(window.lastMapLatLng);
    } else {
      el.textContent = "";
    }
  }

  /** Rifreskon koordinatat (p.sh. pas ndryshimit të sistemit). */
  function resetMapCoordHint() {
    refreshCoordDisplay();
  }

  // Ngarkon preferencën e ruajtur dhe vendos vlerën e parazgjedhur
  const sel = document.getElementById("coordSystemSelect");
  const saved = localStorage.getItem(STORAGE_KEY);
  if (sel) {
    if (saved === "wgs84" || saved === "kref") {
      sel.value = saved;
    } else {
      sel.value = "kref";
    }
  }

  // Ruan zgjedhjen dhe rifreskon shfaqjen kur ndryshon sistemi
  sel?.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEY, getCoordSystem());
    refreshCoordDisplay();
  });

  window.getCoordSystem = getCoordSystem;
  window.formatLatLngWithSystem = formatLatLngWithSystem;
  window.formatMapCoords = formatLatLng;
  window.resetMapCoordHint = resetMapCoordHint;
})();
