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
  setStatus("正在請求權限…");
  try {
    // 在可見分頁中請求權限 — 這裡的權限視窗會明確顯示
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    // 立刻關閉，我們只是要取得權限授權，實際偵測在 offscreen 進行
    stream.getTracks().forEach((t) => t.stop());

    setStatus("✓ 權限已授予！正在啟動監控…", "ok");

    // 通知 background：權限已就緒，可以啟動
    chrome.runtime.sendMessage({ type: "PERMISSION_GRANTED" }, () => {
      setStatus("✓ 監控已啟動，3 秒後自動關閉此分頁…", "ok");
      hintEl.innerHTML =
        "點工具列的眼睛圖示可隨時查看狀態或停止監控。";
      // 自動關閉這個權限分頁，避免它一直是「當前分頁」導致提示無法注入
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: "CLOSE_PERMISSION_TAB" });
      }, 3000);
    });
  } catch (e) {
    grantBtn.disabled = false;
    if (e.name === "NotAllowedError") {
      setStatus("✗ 權限被拒絕", "err");
      hintEl.innerHTML =
        "若是不小心關掉了，請再按一次按鈕。<br>" +
        "若按鈕沒反應，可能是之前封鎖過：點網址列左側的圖示 → 找到「攝影機」→ 改為「允許」，再重新整理此頁。";
    } else if (e.name === "NotFoundError") {
      setStatus("✗ 找不到攝影機裝置", "err");
      hintEl.textContent = "請確認電腦有可用的攝影機，且沒有被其他程式佔用。";
    } else {
      setStatus("✗ 發生錯誤：" + e.message, "err");
    }
  }
}

grantBtn.addEventListener("click", requestCamera);

// 自動嘗試一次（部分情況下會直接彈出權限視窗）
window.addEventListener("load", () => {
  setTimeout(requestCamera, 400);
});
