// permission.js
const grantBtn = document.getElementById("grant");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

async function requestCamera() {
  grantBtn.disabled = true;
  setStatus(chrome.i18n.getMessage("permStatusRequesting"));
  try {
    // 在可見分頁中請求權限 — 這裡的權限視窗會明確顯示
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    // 立刻關閉，我們只是要取得權限授權，實際偵測在 offscreen 進行
    stream.getTracks().forEach((t) => t.stop());

    setStatus(chrome.i18n.getMessage("permStatusGranted"), "ok");

    // 通知 background：權限已就緒，可以啟動
    chrome.runtime.sendMessage({ type: "PERMISSION_GRANTED" }, () => {
      setStatus(chrome.i18n.getMessage("permStatusStarting"), "ok");
      hintEl.innerHTML = chrome.i18n.getMessage("permHintStarted");
      // 自動關閉這個權限分頁，避免它一直是「當前分頁」導致提示無法注入
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: "CLOSE_PERMISSION_TAB" });
      }, 3000);
    });
  } catch (e) {
    grantBtn.disabled = false;
    if (e.name === "NotAllowedError") {
      setStatus(chrome.i18n.getMessage("permStatusDenied"), "err");
      hintEl.innerHTML = chrome.i18n.getMessage("permHintDenied");
    } else if (e.name === "NotFoundError") {
      setStatus(chrome.i18n.getMessage("permStatusNoDevice"), "err");
      hintEl.textContent = chrome.i18n.getMessage("permHintNoDevice");
    } else {
      setStatus(chrome.i18n.getMessage("permStatusErrorPrefix") + e.message, "err");
    }
  }
}

grantBtn.addEventListener("click", requestCamera);

// 自動嘗試一次（部分情況下會直接彈出權限視窗）
window.addEventListener("load", () => {
  setTimeout(requestCamera, 400);
});
