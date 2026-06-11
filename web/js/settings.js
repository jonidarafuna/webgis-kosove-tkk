/**
 * SKEDARI: settings.js
 * QËLLIMI: Menaxhon gjuhën e aplikacionit dhe temën vizuale (errët / e çelët).
 * KUR NGARKOHET: Pas data-i18n.js, para coords.js (index.html); initSettings në DOMContentLoaded.
 * LIDHET ME: i18n.js (getLang, setLang, applyI18n, t), map-basemaps.js (applyThemeToBasemap).
 *
 * Gjuha + tema (errët / e çelët)
 */

/** Lexon temën aktuale nga atributi data-theme i HTML. */
function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** Vendos temën, e ruan në localStorage dhe njofton hartën. */
function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  if (next === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("tkkTheme", next);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", next === "light" ? "#efe9df" : "#0a0e14");
  }

  updateThemeToggleUi();
  if (typeof window.applyThemeToBasemap === "function") {
    window.applyThemeToBasemap();
  }
  window.dispatchEvent(
    new CustomEvent("tkk:theme-change", { detail: { theme: next } })
  );
}

/** Kthen temën midis errët dhe të çelët. */
function toggleTheme() {
  const next = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
}

/** Ngarkon temën e ruajtur nga localStorage para shfaqjes së faqes. */
function loadTheme() {
  if (localStorage.getItem("tkkTheme") === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

/** Përditëson tekstin dhe gjendjen e butonit të temës. */
function updateThemeToggleUi() {
  const btn = document.getElementById("appThemeToggle");
  if (!btn) return;
  const light = getTheme() === "light";
  btn.setAttribute("aria-pressed", light ? "true" : "false");
  btn.title = light ? t("settings.themeLight") : t("settings.themeDark");
  btn.setAttribute(
    "aria-label",
    light ? t("settings.themeLight") : t("settings.themeDark")
  );
}

/** Inicializon zgjedhësin e gjuhës, butonin e temës dhe përkthimet. */
function initSettings() {
  loadTheme();
  updateThemeToggleUi();

  const langSelect = document.getElementById("appLangSelect");
  if (langSelect) {
    langSelect.value = getLang();
    // Ndryshon gjuhën kur përdoruesi zgjedh nga lista
    langSelect.addEventListener("change", () => {
      setLang(langSelect.value);
      updateThemeToggleUi();
    });
  }

  // Klikimi i ikonës së diellit/hënës ndërron temën
  document.getElementById("appThemeToggle")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleTheme();
  });

  // Rifreskon UI-n e temës kur ndryshon gjuha
  window.addEventListener("tkk:lang-change", () => {
    updateThemeToggleUi();
  });

  applyI18n();

  if (typeof window.applyThemeToBasemap === "function") {
    window.applyThemeToBasemap();
  }
}

window.getTheme = getTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
document.addEventListener("DOMContentLoaded", initSettings);
