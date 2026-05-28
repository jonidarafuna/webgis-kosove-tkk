/** Gjuha + tema (errët / e çelët) */

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  if (next === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("tkkTheme", next);
  updateThemeToggleUi();
  window.dispatchEvent(
    new CustomEvent("tkk:theme-change", { detail: { theme: next } })
  );
}

function toggleTheme() {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

function loadTheme() {
  if (localStorage.getItem("tkkTheme") === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

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

function initSettings() {
  loadTheme();
  updateThemeToggleUi();

  const langSelect = document.getElementById("appLangSelect");
  if (langSelect) {
    langSelect.value = getLang();
    langSelect.addEventListener("change", () => {
      setLang(langSelect.value);
      updateThemeToggleUi();
    });
  }

  document.getElementById("appThemeToggle")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleTheme();
  });

  window.addEventListener("tkk:lang-change", () => {
    updateThemeToggleUi();
  });

  applyI18n();
}

window.getTheme = getTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
document.addEventListener("DOMContentLoaded", initSettings);
