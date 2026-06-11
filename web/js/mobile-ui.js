/**
 * SKEDARI: mobile-ui.js
 * QËLLIMI: Adapton UI-n për ekrane të vogla — drawer, bottom sheet dhe navigim poshtë.
 * KUR NGARKOHET: Pas sidebar.js, para timeline.js (index.html); ekzekutohet menjëherë (IIFE).
 * LIDHET ME: sidebar.js (tkkOpenFlyout, tkkCloseFlyouts), detail.js (showDetailPanel),
 *            map.js (map.invalidateSize), timeline.js (renderTimelineTicks).
 *
 * UI mobil: hartë e plotë, panele si drawer / bottom sheet, navigim poshtë.
 */
(function () {
  // Pragu i gjerësisë (px) për të konsideruar pajisjen mobil
  const BP = 768;
  const mq = window.matchMedia("(max-width: " + BP + "px)");

  let activePanel = null;
  let invalidateTimer = null;

  /** Kontrollon nëse ekrani është në modalitet mobil. */
  function isMobile() {
    return mq.matches;
  }

  /** Rifreskon madhësinë e hartës pa ndryshuar zoom-in (shmang “shkallën” që vazhdon lart). */
  function invalidateMapStable() {
    window.clearTimeout(invalidateTimer);
    invalidateTimer = window.setTimeout(function () {
      var map = window.map;
      if (!map || typeof map.invalidateSize !== "function") return;
      var center = map.getCenter();
      var zoom = map.getZoom();
      map.invalidateSize({ animate: false, pan: false });
      if (map.getZoom() !== zoom) {
        map.setZoom(zoom, { animate: false });
      }
      map.setView(center, zoom, { animate: false });
    }, 400);
  }

  /** Thekson butonin aktiv në navigimin poshtë. */
  function setNavActive(name) {
    document.querySelectorAll(".mobile-nav-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.mobilePanel === name);
    });
  }

  /** Heq të gjitha klasat CSS të paneleve mobile nga body. */
  function clearPanelClasses() {
    document.body.classList.remove(
      "mobile-open",
      "mobile-panel-layers",
      "mobile-panel-search",
      "mobile-panel-filters",
      "mobile-panel-chart",
      "mobile-panel-detail"
    );
  }

  /** Mbyll panelet mobile dhe backdrop-in. */
  function closeMobilePanels(opts) {
    opts = opts || {};
    activePanel = null;
    clearPanelClasses();
    setNavActive(null);
    var backdrop = document.getElementById("mobileBackdrop");
    if (backdrop) backdrop.hidden = true;
    if (typeof window.tkkCloseFlyouts === "function") {
      window.tkkCloseFlyouts();
    }
    if (!opts.skipInvalidate && !isMobile()) {
      invalidateMapStable();
    }
  }

  /** Hap një panel mobile (shtresa, kërkim, filtra, grafik, detaje). */
  function openMobilePanel(name, opts) {
    if (!isMobile()) return;
    opts = opts || {};
    if (!opts.force && activePanel === name) {
      closeMobilePanels();
      return;
    }

    closeMobilePanels({ skipInvalidate: true });
    activePanel = name;
    document.body.classList.add("mobile-open", "mobile-panel-" + name);
    var backdrop = document.getElementById("mobileBackdrop");
    if (backdrop) backdrop.hidden = false;
    setNavActive(name);

    if (name === "layers") {
      if (typeof window.tkkCloseFlyouts === "function") {
        window.tkkCloseFlyouts();
      }
      var sidebarLeft = document.getElementById("sidebarLeft");
      if (sidebarLeft) sidebarLeft.classList.remove("is-suppressed");
    } else if (name === "search" || name === "filters" || name === "chart") {
      if (typeof window.tkkOpenFlyout === "function") {
        window.tkkOpenFlyout(name);
      }
    } else if (name === "detail") {
      var panel = document.getElementById("detailPanel");
      if (panel && panel.classList.contains("is-closed")) {
        closeMobilePanels();
        return;
      }
    }
  }

  /** Sinkronizon modalitetin mobil kur ndryshon madhësia e ekranit. */
  function syncMobileMode() {
    document.body.classList.toggle("is-mobile", mq.matches);
    var nav = document.getElementById("mobileNav");
    if (nav) nav.hidden = !mq.matches;

    if (!mq.matches) {
      closeMobilePanels();
      return;
    }

    if (typeof window.setSidebarCollapsed === "function") {
      window.setSidebarCollapsed(true);
    }
    closeMobilePanels({ skipInvalidate: true });
    updateDetailNavState();
    if (typeof window.renderTimelineTicks === "function") {
      window.renderTimelineTicks();
    }
    invalidateMapStable();
  }

  /** Aktivizon ose çaktivizon butonin e detajeve në nav. */
  function updateDetailNavState() {
    var btn = document.querySelector('.mobile-nav-btn[data-mobile-panel="detail"]');
    if (!btn) return;
    var panel = document.getElementById("detailPanel");
    var disabled = !panel || panel.classList.contains("is-closed");
    btn.disabled = disabled;
  }

  /** Mbyll panelet kur klikohet backdrop-i i errët. */
  function onBackdropClick() {
    closeMobilePanels();
  }

  /** Lidh butonat e navigimit poshtë me panelet përkatëse. */
  function initNav() {
    var nav = document.getElementById("mobileNav");
    if (!nav) return;

    nav.querySelectorAll(".mobile-nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        openMobilePanel(btn.dataset.mobilePanel || "layers");
      });
    });
  }

  /** Shtron panelin e detajeve automatikisht në mobil pas zgjedhjes së monumentit. */
  function hookDetailPanel() {
    var origShow = window.showDetailPanel;
    if (typeof origShow === "function") {
      window.showDetailPanel = function (feature) {
        origShow(feature);
        updateDetailNavState();
        if (isMobile()) {
          openMobilePanel("detail", { force: true });
        }
      };
    }

    var closeBtn = document.getElementById("detailClose");
    if (closeBtn) {
      closeBtn.addEventListener(
        "click",
        function () {
          window.setTimeout(function () {
            updateDetailNavState();
            if (isMobile() && activePanel === "detail") {
              closeMobilePanels();
            }
          }, 0);
        },
        true
      );
    }
  }

  /** Mbyll panelet mobile kur mbyllen flyout-et e sidebar-it. */
  function hookFlyoutClose() {
    document.querySelectorAll("[data-flyout-close]").forEach(function (btn) {
      btn.addEventListener(
        "click",
        function () {
          if (isMobile()) closeMobilePanels();
        },
        true
      );
    });
  }

  /** Inicializon backdrop, nav, hooks dhe dëgjuesin e madhësisë së ekranit. */
  function init() {
    var backdrop = document.getElementById("mobileBackdrop");
    if (backdrop) {
      backdrop.addEventListener("click", onBackdropClick);
    }
    initNav();
    hookDetailPanel();
    hookFlyoutClose();

    // Reagoj kur ndryshon gjerësia e dritares (portrait/landscape)
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", syncMobileMode);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(syncMobileMode);
    }

    syncMobileMode();
  }

  window.tkkCloseMobilePanels = closeMobilePanels;
  window.tkkOpenMobilePanel = openMobilePanel;
  window.tkkIsMobile = isMobile;
  window.tkkInvalidateMapSize = invalidateMapStable;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
