// background.js
// Service worker：管理 offscreen document 生命週期、處理觸發事件、
// 執行分頁切換與系統通知。

let isMonitoring = false;

// 確保 offscreen document 存在
async function ensureOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification:
      "在背景使用攝影機進行本機人臉偵測，以判斷是否有人靠近並注視螢幕。",
  });
}

async function closeOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

async function startMonitoring() {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ target: "offscreen", type: "START" });
  isMonitoring = true;
  await chrome.storage.local.set({ monitoring: true });
}

// 檢查是否已有攝影機權限（透過 Permissions API）
async function hasCameraPermission() {
  try {
    // offscreen 無法用 navigator.permissions，改由嘗試啟動時判斷。
    // 這裡用 storage 記錄是否曾成功授權過。
    const data = await chrome.storage.local.get("cameraGranted");
    return data.cameraGranted === true;
  } catch (e) {
    return false;
  }
}

// 開啟權限引導分頁
async function openPermissionPage() {
  const url = chrome.runtime.getURL("permission.html");
  // 若已有同樣的分頁就聚焦它，否則新開
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

async function stopMonitoring() {
  try {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "STOP" });
  } catch (e) {
    /* offscreen 可能已關閉 */
  }
  await closeOffscreen();
  isMonitoring = false;
  await chrome.storage.local.set({ monitoring: false });
}

// 觸發時的動作：畫面提示 + 切換分頁
async function handleTrigger(info) {
  console.log("[GazeGuard/BG] handleTrigger 被呼叫，info=", info);
  const cfg = await chrome.storage.local.get([
    "gazeSettings",
    "targetTabId",
    "actionMode",
    "overlayMode",
    "overlayColor",
    "overlayDurationMs",
  ]);
  const actionMode = cfg.actionMode || "notify_and_switch";
  const overlayOpts = {
    overlayMode: cfg.overlayMode || "border",
    overlayColor: cfg.overlayColor || "#c9a35b",
    overlayDurationMs: cfg.overlayDurationMs || 1500,
  };
  console.log(
    `[GazeGuard/BG] actionMode=${actionMode}, overlayOpts=`,
    overlayOpts
  );

  const wantOverlay =
    actionMode === "overlay_only" || actionMode === "notify_and_switch";
  const wantSwitch =
    actionMode === "switch_only" || actionMode === "notify_and_switch";
  console.log(`[GazeGuard/BG] wantOverlay=${wantOverlay}, wantSwitch=${wantSwitch}`);

  // 先看當前分頁能否注入
  let activeTab = null;
  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {}
  const activeInjectable =
    activeTab && /^https?:|^file:/.test(activeTab.url || "");
  console.log(
    `[GazeGuard/BG] activeTab url=${activeTab?.url}, 可注入=${activeInjectable}`
  );

  // 取得目標分頁
  let target = null;
  if (wantSwitch && cfg.targetTabId) {
    try {
      target = await chrome.tabs.get(cfg.targetTabId);
    } catch (e) {
      target = null;
    }
  }
  const targetInjectable = target && /^https?:|^file:/.test(target.url || "");

  // 決定提示要顯示在哪個分頁
  if (wantOverlay) {
    if (activeInjectable) {
      // 當前分頁可注入：先在這裡顯示提示，之後再切換
      await showOverlayOnTab(activeTab, info, overlayOpts);
    } else if (target && targetInjectable) {
      // 當前分頁不可注入（例如擴充頁），但目標分頁可以：
      // 先切換過去，再在目標分頁顯示提示
      console.log("[GazeGuard/BG] 當前分頁不可注入，改切換到目標分頁後顯示提示");
      try {
        await chrome.tabs.update(target.id, { active: true });
        await chrome.windows.update(target.windowId, { focused: true });
      } catch (e) {}
      // 稍等分頁切換完成
      await new Promise((r) => setTimeout(r, 200));
      await showOverlayOnTab(target, info, overlayOpts);
      // 已經切換過了，標記不需再切
      target = null;
    } else {
      console.warn("[GazeGuard/BG] 當前與目標分頁皆不可注入，改用系統通知");
      showSystemNotification(info);
    }
  }

  // 切換分頁（若上面尚未切換）
  if (wantSwitch && target) {
    const delay = wantOverlay ? overlayOpts.overlayDurationMs : 0;
    console.log(`[GazeGuard/BG] ${delay}ms 後切換到分頁`, target.id);
    setTimeout(async () => {
      try {
        await chrome.tabs.update(target.id, { active: true });
        await chrome.windows.update(target.windowId, { focused: true });
      } catch (e) {}
    }, delay);
  }

  await chrome.storage.local.set({ lastTrigger: { time: Date.now(), info } });
}

// 在指定分頁注入並顯示覆蓋層
async function showOverlayOnTab(tab, info, overlayOpts) {
  try {
    console.log("[GazeGuard/BG] 注入 overlay.js 到分頁", tab.id);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["overlay.js"],
    });
    console.log("[GazeGuard/BG] 注入成功");
  } catch (e) {
    console.warn("[GazeGuard/BG] 注入失敗，改用系統通知", e);
    showSystemNotification(info);
    return;
  }

  const send = (attempt) =>
    chrome.tabs
      .sendMessage(tab.id, { type: "SHOW_OVERLAY", info, opts: overlayOpts })
      .then((r) => console.log(`[GazeGuard/BG] SHOW_OVERLAY 送達(第${attempt}次)，回應=`, r))
      .catch((e) => {
        console.warn(`[GazeGuard/BG] 第${attempt}次傳送失敗`, e);
        if (attempt === 1) {
          setTimeout(() => send(2), 250);
        } else {
          showSystemNotification(info);
        }
      });
  send(1);
}

// 系統通知（覆蓋層無法注入時的備援）
function showSystemNotification(info) {
  const distText = info.distanceCm ? `約 ${info.distanceCm} cm` : "近距離";
  chrome.notifications.create("gaze-alert-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "有人在看你的螢幕",
    message: `偵測到${distText}處有人正面注視鏡頭。`,
    priority: 2,
  });
}

// 來自 offscreen / popup 的訊息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 來自 offscreen 的事件
  if (msg.type === "GAZE_TRIGGER") {
    console.log("[GazeGuard/BG] 收到 GAZE_TRIGGER 訊息");
    handleTrigger(msg.info);
    return;
  }

  // 關閉權限引導分頁
  if (msg.type === "CLOSE_PERMISSION_TAB") {
    const url = chrome.runtime.getURL("permission.html");
    chrome.tabs.query({ url }, (tabs) => {
      for (const t of tabs) {
        chrome.tabs.remove(t.id).catch(() => {});
      }
    });
    return;
  }
  if (msg.type === "GAZE_STATUS") {
    // 轉發給 popup（若開啟）。popup 自行監聽，這裡不需處理。
    return;
  }

  // offscreen 請求設定（因 offscreen 無法直接存取 chrome.storage）
  if (msg.type === "OFFSCREEN_GET_SETTINGS") {
    chrome.storage.local.get("gazeSettings").then((data) => {
      sendResponse({ gazeSettings: data.gazeSettings || null });
    });
    return true;
  }
  if (msg.type === "GAZE_ERROR") {
    chrome.storage.local.set({ lastError: msg.error });
    isMonitoring = false;
    chrome.storage.local.set({ monitoring: false });
    // 若是權限相關錯誤，清除授權旗標，下次啟動會重新引導
    if (/NotAllowed|Permission|dismissed/i.test(msg.error)) {
      chrome.storage.local.set({ cameraGranted: false });
    }
    return;
  }

  // 來自 popup 的指令
  if (msg.type === "POPUP_START") {
    (async () => {
      const granted = await hasCameraPermission();
      if (!granted) {
        // 尚未授權過攝影機，開引導頁讓使用者在可見分頁中授權
        await openPermissionPage();
        sendResponse({ ok: false, needPermission: true });
        return;
      }
      try {
        await startMonitoring();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // 來自權限引導頁：權限已授予
  if (msg.type === "PERMISSION_GRANTED") {
    (async () => {
      await chrome.storage.local.set({ cameraGranted: true });
      await chrome.storage.local.remove("lastError");
      try {
        await startMonitoring();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.type === "POPUP_STOP") {
    stopMonitoring()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "POPUP_GET_STATE") {
    sendResponse({ monitoring: isMonitoring });
    return true;
  }
  if (msg.type === "POPUP_RELOAD_SETTINGS") {
    chrome.runtime
      .sendMessage({ target: "offscreen", type: "RELOAD_SETTINGS" })
      .catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});

// 安裝時初始化預設設定
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("gazeSettings");
  if (!existing.gazeSettings) {
    await chrome.storage.local.set({
      gazeSettings: {
        triggerDistanceCm: 80,
        holdSeconds: 2.5,
        cooldownSeconds: 20,
        yawThreshold: 22,
        pitchThreshold: 22,
        focalLengthPx: 650,
        extraFaceThreshold: 1,
      },
      actionMode: "notify_and_switch",
      overlayMode: "border",
      overlayColor: "#c9a35b",
      overlayDurationMs: 1500,
      monitoring: false,
    });
  } else {
    // 既有使用者補上新欄位的預設值
    const patch = {};
    const cur = await chrome.storage.local.get([
      "overlayMode",
      "overlayColor",
      "overlayDurationMs",
    ]);
    if (cur.overlayMode === undefined) patch.overlayMode = "border";
    if (cur.overlayColor === undefined) patch.overlayColor = "#c9a35b";
    if (cur.overlayDurationMs === undefined) patch.overlayDurationMs = 1500;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  }
});
