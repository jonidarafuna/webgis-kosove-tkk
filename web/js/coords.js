/**
 * Shfaqja e koordinatave: WGS84 ose KOSOVAREF01 (EPSG:9141).
 */
(function () {
  const STORAGE_KEY = "tkkCoordSystem";

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

  function getCoordSystem() {
    const sel = document.getElementById("coordSystemSelect");
    return sel && sel.value === "kref" ? "kref" : "wgs84";
  }

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

  function formatLatLng(latlng) {
    return formatLatLngWithSystem(latlng, getCoordSystem());
  }

  function refreshCoordDisplay() {
    const el = document.getElementById("mapCoords");
    if (!el) return;
    if (window.lastMapLatLng) {
      el.textContent = formatLatLng(window.lastMapLatLng);
    } else {
      el.textContent = "";
    }
  }

  function resetMapCoordHint() {
    refreshCoordDisplay();
  }

  const sel = document.getElementById("coordSystemSelect");
  const saved = localStorage.getItem(STORAGE_KEY);
  if (sel) {
    if (saved === "wgs84" || saved === "kref") {
      sel.value = saved;
    } else {
      sel.value = "kref";
    }
  }

  sel?.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEY, getCoordSystem());
    refreshCoordDisplay();
  });

  window.getCoordSystem = getCoordSystem;
  window.formatLatLngWithSystem = formatLatLngWithSystem;
  window.formatMapCoords = formatLatLng;
  window.resetMapCoordHint = resetMapCoordHint;
})();
