// Tiny i18n helper. Walks [data-i18n*] attributes and substitutes via chrome.i18n.
function applyI18n(root) {
  root = root || document;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nHtml);
    if (msg) el.innerHTML = msg;
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
  const docTitleKey = document.documentElement.getAttribute("data-i18n-doc-title");
  if (docTitleKey) {
    const msg = chrome.i18n.getMessage(docTitleKey);
    if (msg) document.title = msg;
  }
  document.documentElement.lang = chrome.i18n.getUILanguage();
}

if (typeof window !== "undefined") {
  window.applyI18n = applyI18n;
  document.addEventListener("DOMContentLoaded", () => applyI18n());
}
