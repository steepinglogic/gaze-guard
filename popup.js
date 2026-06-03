// popup.js
const $ = (id) => document.getElementById(id);

const toggleBtn = $("toggle");
const stateDot = $("state-dot");
const stateText = $("state-text");
const faceText = $("face-text");
const distText = $("dist-text");
const angleText = $("angle-text");
const watchFill = $("watch-fill");
const errorBox = $("error-box");
const targetCurrent = $("target-current");
const kofiBtn = $("kofi-btn");

let monitoring = false;
let currentSettings = {};

// --- 載入設定到 UI ---
async function loadUI() {
  const data = await chrome.storage.local.get([
    "gazeSettings",
    "actionMode",
    "overlayMode",
    "overlayColor",
    "overlayDurationMs",
    "targetTabId",
    "targetTabTitle",
    "monitoring",
    "lastError",
  ]);

  const s = data.gazeSettings || {};
  currentSettings = s;

  $("trigger-distance").value = s.triggerDistanceCm ?? 80;
  $("dist-val").textContent = s.triggerDistanceCm ?? 80;
  $("extra-face").value = s.extraFaceThreshold ?? 1;
  $("extra-face-val").textContent = s.extraFaceThreshold ?? 1;
  $("hold-seconds").value = s.holdSeconds ?? 2.5;
  $("hold-val").textContent = s.holdSeconds ?? 2.5;
  $("cooldown-seconds").value = s.cooldownSeconds ?? 20;
  $("cooldown-val").textContent = s.cooldownSeconds ?? 20;
  $("yaw-threshold").value = s.yawThreshold ?? 22;
  $("yaw-val").textContent = s.yawThreshold ?? 22;
  $("focal-length").value = s.focalLengthPx ?? 650;
  $("focal-val").textContent = s.focalLengthPx ?? 650;

  $("action-mode").value = data.actionMode || "notify_and_switch";

  // 提示方式
  $("overlay-mode").value = data.overlayMode || "border";
  const curColor = data.overlayColor || "#c9a35b";
  document.querySelectorAll(".color-swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === curColor);
    b.style.color = b.dataset.color; // 供 active 外框光暈用
  });
  $("overlay-duration").value = data.overlayDurationMs || 1500;
  $("duration-val").textContent = data.overlayDurationMs || 1500;

  if (data.targetTabTitle) {
    targetCurrent.textContent = data.targetTabTitle;
  } else {
    targetCurrent.textContent = "尚未設定（將不切換分頁）";
  }

  // 向 background 詢問實際監控狀態
  chrome.runtime.sendMessage({ type: "POPUP_GET_STATE" }, (resp) => {
    monitoring = resp?.monitoring || false;
    renderState();
  });

  if (data.lastError) {
    showError("上次啟動發生錯誤：" + data.lastError);
  }
}

function renderState() {
  if (monitoring) {
    toggleBtn.textContent = "停止";
    toggleBtn.classList.add("on");
    stateDot.className = "dot green";
    stateText.textContent = "監控中";
  } else {
    toggleBtn.textContent = "啟動";
    toggleBtn.classList.remove("on");
    stateDot.className = "dot";
    stateText.textContent = "未啟動";
    faceText.textContent = "—";
    distText.textContent = "—";
    angleText.textContent = "—";
    watchFill.style.width = "0%";
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}
function clearError() {
  errorBox.style.display = "none";
}

// --- 切換啟動/停止 ---
toggleBtn.addEventListener("click", async () => {
  clearError();
  if (!monitoring) {
    toggleBtn.textContent = "啟動中…";
    chrome.runtime.sendMessage({ type: "POPUP_START" }, (resp) => {
      if (resp?.ok) {
        monitoring = true;
        chrome.storage.local.remove("lastError");
      } else if (resp?.needPermission) {
        showError("已開啟權限頁分頁，請在該分頁按「允許使用攝影機」。");
        monitoring = false;
      } else {
        showError("啟動失敗：" + (resp?.error || "未知錯誤"));
      }
      renderState();
    });
  } else {
    chrome.runtime.sendMessage({ type: "POPUP_STOP" }, () => {
      monitoring = false;
      renderState();
    });
  }
});

// --- Ko-fi 按鈕 ---
kofiBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://ko-fi.com/steepinglogic" });
});

// --- 設定目標分頁 ---
$("set-target").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    const tab = tabs[0];
    await chrome.storage.local.set({
      targetTabId: tab.id,
      targetTabTitle: tab.title || tab.url,
    });
    targetCurrent.textContent = tab.title || tab.url;
  }
});

// --- 動作模式 ---
$("action-mode").addEventListener("change", async (e) => {
  await chrome.storage.local.set({ actionMode: e.target.value });
});

// --- 提示方式：模式 ---
$("overlay-mode").addEventListener("change", async (e) => {
  await chrome.storage.local.set({ overlayMode: e.target.value });
  updateColorLabel();
});

// --- 提示方式：顏色色票 ---
document.querySelectorAll(".color-swatch").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".color-swatch").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");
    await chrome.storage.local.set({ overlayColor: btn.dataset.color });
  });
});

// --- 提示方式：顯示時間 ---
$("overlay-duration").addEventListener("input", (e) => {
  $("duration-val").textContent = e.target.value;
});
$("overlay-duration").addEventListener("change", async (e) => {
  await chrome.storage.local.set({ overlayDurationMs: parseInt(e.target.value) });
});

// 依模式調整顏色欄位標籤（兩種模式都用顏色，只是說明不同）
function updateColorLabel() {
  const mode = $("overlay-mode").value;
  const label = document.querySelector("#color-field label");
  if (label) label.textContent = mode === "border" ? "邊框顏色" : "標示顏色";
}
updateColorLabel();

// --- 參數滑桿 ---
function bindSlider(sliderId, valId, key, isFloat) {
  $(sliderId).addEventListener("input", (e) => {
    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    $(valId).textContent = v;
  });
  $(sliderId).addEventListener("change", async (e) => {
    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
    currentSettings[key] = v;
    await chrome.storage.local.set({ gazeSettings: currentSettings });
    chrome.runtime.sendMessage({ type: "POPUP_RELOAD_SETTINGS" });
  });
}
bindSlider("extra-face", "extra-face-val", "extraFaceThreshold", false);
bindSlider("trigger-distance", "dist-val", "triggerDistanceCm", false);
bindSlider("hold-seconds", "hold-val", "holdSeconds", true);
bindSlider("cooldown-seconds", "cooldown-val", "cooldownSeconds", false);
bindSlider("yaw-threshold", "yaw-val", "yawThreshold", false);
bindSlider("focal-length", "focal-val", "focalLengthPx", false);

// --- 接收即時偵測狀態 ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "GAZE_STATUS" && monitoring) {
    const info = msg.info;
    if (info.faceFound) {
      const wc = info.watchingCount ?? 0;
      const fc = info.faceCount ?? 1;
      faceText.innerHTML = `<span class="dot green"></span>${fc} 張（注視 ${wc}）`;
      distText.textContent = info.distanceCm ? info.distanceCm + " cm" : "—";
      angleText.textContent = `${info.yaw}° / ${info.pitch}°`;

      const hold = currentSettings.holdSeconds || 2.5;
      const pct = Math.min(100, ((info.heldSeconds || 0) / hold) * 100);
      watchFill.style.width = pct + "%";
      watchFill.style.background = info.watching ? "var(--amber)" : "var(--surface-2)";
    } else {
      faceText.innerHTML = `<span class="dot"></span>否`;
      distText.textContent = "—";
      angleText.textContent = "—";
      watchFill.style.width = "0%";
    }
  }
  if (msg.type === "GAZE_ERROR") {
    showError("偵測錯誤：" + msg.error);
    monitoring = false;
    renderState();
  }
  if (msg.type === "GAZE_STOPPED") {
    monitoring = false;
    renderState();
  }
});

loadUI();
