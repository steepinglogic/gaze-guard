// Runtime i18n helper for popup + permission pages.
// Monkey-patches chrome.i18n.getMessage so consumer code does not change.
// User-selected locale (chrome.storage.local.userLocale) overrides browser UI language.

(function () {
  let overrideMap = null;
  let overrideCode = null;

  function substitute(map, key, subs) {
    const entry = map[key];
    if (!entry) return null;
    let msg = entry.message;
    const placeholders = entry.placeholders || {};
    const sArr = Array.isArray(subs) ? subs : subs != null ? [subs] : [];
    for (const [name, def] of Object.entries(placeholders)) {
      const i = parseInt(String(def.content).replace("$", ""), 10) - 1;
      const tok = "$" + name.toUpperCase() + "$";
      msg = msg.split(tok).join(sArr[i] ?? "");
    }
    return msg;
  }

  async function loadOverride() {
    overrideMap = null;
    overrideCode = null;
    try {
      const { userLocale } = await chrome.storage.local.get("userLocale");
      if (!userLocale || userLocale === "auto") return;
      const url = chrome.runtime.getURL(`_locales/${userLocale}/messages.json`);
      const res = await fetch(url);
      if (res.ok) {
        overrideMap = await res.json();
        overrideCode = userLocale;
      }
    } catch (e) {
      /* fall back to chrome.i18n */
    }
  }

  const origGet = chrome.i18n.getMessage.bind(chrome.i18n);
  chrome.i18n.getMessage = function (key, subs) {
    if (overrideMap) {
      const v = substitute(overrideMap, key, subs);
      if (v) return v;
    }
    return origGet(key, subs);
  };

  window.i18nReady = loadOverride();

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
    document.documentElement.lang = (overrideCode || chrome.i18n.getUILanguage()).replace("_", "-");
  }
  window.applyI18n = applyI18n;

  document.addEventListener("DOMContentLoaded", async () => {
    await window.i18nReady;
    applyI18n();
  });

  window.i18nReload = async () => {
    await loadOverride();
    applyI18n();
  };

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local" || !changes.userLocale) return;
    await window.i18nReload();
  });
})();
