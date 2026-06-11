import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "store-assets");

const chromeStub = `
  window.chrome = {
    storage: {
      local: {
        _data: {
          gazeSettings: { triggerDistanceCm: 80, extraFaceThreshold: 1, holdSeconds: 2.5, cooldownSeconds: 20, yawThreshold: 22, focalLengthPx: 650 },
          actionMode: "notify_and_switch",
          overlayMode: "border",
          overlayColor: "#c9a35b",
          overlayDurationMs: 1500,
          targetTabId: 99,
          targetTabTitle: "Pinned · 安全分頁 (預設)",
          monitoring: true,
        },
        get(keys, cb) {
          const r = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) r[k] = this._data[k];
          if (cb) cb(r);
          return Promise.resolve(r);
        },
        set(obj, cb) { Object.assign(this._data, obj); if (cb) cb(); return Promise.resolve(); },
        remove(keys, cb) { if (cb) cb(); return Promise.resolve(); },
      },
    },
    runtime: {
      _listeners: [],
      sendMessage(msg, cb) {
        if (msg && msg.type === "POPUP_GET_STATE") { const r = { monitoring: true }; if (cb) cb(r); return Promise.resolve(r); }
        const r = { ok: true };
        if (cb) cb(r);
        return Promise.resolve(r);
      },
      onMessage: { addListener: (fn) => window.chrome.runtime._listeners.push(fn) },
      getURL: (p) => p,
    },
    tabs: {
      create() {},
      query() { return Promise.resolve([{ id: 1, title: "Demo", url: "about:blank" }]); },
    },
  };
`;

async function shot(browser, url, viewport, outFile, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (opts.initScript) await ctx.addInitScript(opts.initScript);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  if (opts.afterLoad) await opts.afterLoad(page);
  await page.waitForTimeout(opts.settleMs ?? 300);
  await page.screenshot({ path: outFile, type: "png", omitBackground: false });
  await ctx.close();
  console.log("✓", path.basename(outFile));
}

const fileUrl = (rel) => "file://" + path.join(root, rel);

(async () => {
  const browser = await chromium.launch();

  await shot(
    browser,
    fileUrl("tools/popup-frame.html"),
    { width: 1280, height: 800 },
    path.join(out, "screenshot-1-popup.png"),
    {
      initScript: chromeStub,
      afterLoad: async (page) => {
        const frame = page.frames().find((f) => f.url().endsWith("popup.html"));
        if (!frame) return;
        await frame.waitForLoadState("load");
        await frame.evaluate(() => {
          const $ = (id) => document.getElementById(id);
          $("face-text").innerHTML = '<span class="dot green"></span>2 張（注視 1）';
          $("dist-text").textContent = "82 cm";
          $("angle-text").textContent = "3.2° / -1.8°";
          $("watch-fill").style.width = "62%";
          $("watch-fill").style.background = "var(--amber)";
          const target = document.getElementById("target-current");
          if (target) target.textContent = "Pinned · 安全分頁 (預設)";
        });
      },
      settleMs: 500,
    },
  );

  await shot(
    browser,
    fileUrl("tools/overlay-border.html"),
    { width: 1280, height: 800 },
    path.join(out, "screenshot-2-overlay-border.png"),
    { settleMs: 350 },
  );

  await shot(
    browser,
    fileUrl("tools/overlay-marker.html"),
    { width: 1280, height: 800 },
    path.join(out, "screenshot-3-overlay-marker.png"),
    { settleMs: 200 },
  );

  await shot(
    browser,
    fileUrl("tools/promo-tile.html"),
    { width: 440, height: 280 },
    path.join(out, "promo-tile-440x280.png"),
    { settleMs: 200 },
  );

  await browser.close();
})();
