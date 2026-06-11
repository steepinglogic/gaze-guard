// overlay.js — 注入到使用者分頁，顯示視覺提示。
// 支援兩種模式：邊框跑光（border）、人臉位置標示（marker）。

(() => {
  if (window.__gazeGuardOverlayInstalled) {
    console.log("[GazeGuard/Overlay] 已注入過，跳過重複註冊");
    return;
  }
  window.__gazeGuardOverlayInstalled = true;

  const HOST_ID = "gaze-guard-overlay-host";

  function removeHost() {
    const old = document.getElementById(HOST_ID);
    if (old) old.remove();
  }

  function showOverlay(info, opts) {
    removeHost();

    const mode = opts.overlayMode || "border";   // "border" | "marker"
    const color = opts.overlayColor || "#c9a35b"; // 金色預設
    const duration = Math.min(Math.max(opts.overlayDurationMs || 1500, 200), 5000);

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "open" });

    if (mode === "marker") {
      shadow.innerHTML = buildMarker(info, color, duration);
    } else {
      shadow.innerHTML = buildBorder(color, duration);
    }

    document.documentElement.appendChild(host);
    setTimeout(removeHost, duration + 200);
  }

  // ── 模式一：邊框順時針跑光（強化光暈）──
  function buildBorder(color, duration) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const inset = 8;
    const rw = w - inset * 2;
    const rh = h - inset * 2;
    const perim = 2 * (rw + rh);
    const lapMs = 800;
    const laps = Math.max(1, Math.round(duration / lapMs));

    // 光帶長度（彗尾）約佔周長 22%
    const dashOn = perim * 0.22;
    const dashOff = perim - dashOn;

    // 唯一的 filter id，避免多次注入衝突
    const fid = "gg-glow-" + Math.random().toString(36).slice(2, 8);

    return `
      <style>
        @keyframes gg-run {
          from { stroke-dashoffset: ${perim}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes gg-fade-out { to { opacity: 0; } }
        @keyframes gg-breathe { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }

        .gg-border-svg {
          position: fixed; inset: 0;
          width: 100vw; height: 100vh;
          animation: gg-fade-out 0.4s ease ${duration - 400}ms both;
        }
        .gg-rect {
          fill: none;
          stroke-linecap: round;
          stroke-dasharray: ${dashOn} ${dashOff};
          animation: gg-run ${lapMs}ms linear ${laps};
        }
        /* 最外層：寬、強模糊，營造大範圍光暈 */
        .gg-halo  { stroke: ${color}; stroke-width: 26; opacity: 0.35; filter: url(#${fid}-big); }
        /* 中層：中等模糊的發光 */
        .gg-glow  { stroke: ${color}; stroke-width: 12; opacity: 0.7;  filter: url(#${fid}-mid); }
        /* 核心：細、清晰、最亮 */
        .gg-core  { stroke: #ffffff; stroke-width: 3;  opacity: 0.95; filter: url(#${fid}-sml); }
        /* 核心外圈帶顏色 */
        .gg-core2 { stroke: ${color}; stroke-width: 6;  opacity: 0.95; }

        /* 靜態底框微光 */
        .gg-base  { fill: none; stroke: ${color}; stroke-width: 2; opacity: 0.12;
                    animation: gg-breathe 1.6s ease-in-out infinite; }
      </style>
      <svg class="gg-border-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <filter id="${fid}-big" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10"/>
          </filter>
          <filter id="${fid}-mid" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4"/>
          </filter>
          <filter id="${fid}-sml" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2"/>
          </filter>
        </defs>
        <rect class="gg-base"  x="${inset}" y="${inset}" width="${rw}" height="${rh}" rx="3"/>
        <rect class="gg-rect gg-halo"  x="${inset}" y="${inset}" width="${rw}" height="${rh}" rx="3"/>
        <rect class="gg-rect gg-glow"  x="${inset}" y="${inset}" width="${rw}" height="${rh}" rx="3"/>
        <rect class="gg-rect gg-core2" x="${inset}" y="${inset}" width="${rw}" height="${rh}" rx="3"/>
        <rect class="gg-rect gg-core"  x="${inset}" y="${inset}" width="${rw}" height="${rh}" rx="3"/>
      </svg>
    `;
  }

  // ── 模式二：人臉位置標示 ──
  function buildMarker(info, color, duration) {
    const faceBoxes = info.faceBoxes || [info.faceBox || { cx: 0.5, cy: 0.4 }];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const distText = info.distanceCm
      ? chrome.i18n.getMessage("overlayDistAbout", [String(info.distanceCm)])
      : chrome.i18n.getMessage("overlayDistNear");
    const countText = faceBoxes.length > 1
      ? chrome.i18n.getMessage("overlayCount", [String(faceBoxes.length)])
      : "";
    const subText = countText
      ? chrome.i18n.getMessage("overlaySubWithCount", [countText, distText])
      : chrome.i18n.getMessage("overlaySubNoCount", [distText]);
    const titleText = chrome.i18n.getMessage("overlayTitle");

    const markerHTML = faceBoxes.map((fb) => {
      const faceX = Math.round(fb.cx * vw);
      const faceY = Math.round(fb.cy * vh);
      return `
      <div class="gg-marker" style="left:${faceX - 45}px; top:${faceY - 45}px;"></div>
      <div class="gg-arrow" style="left:${faceX - 24}px; top:${faceY - 105}px;">↓</div>`;
    }).join("");

    return `
      <style>
        @keyframes gg-fade-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gg-fade-out { to { opacity: 0; } }
        @keyframes gg-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
        @keyframes gg-pulse { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.12); opacity: 1; } }

        .gg-banner {
          position: fixed; top: 24px; left: 50%;
          transform: translateX(-50%);
          background: #16140f; color: #ebe6d8;
          border: 1px solid ${color}; border-radius: 14px;
          padding: 16px 24px;
          font-family: "Hiragino Sans", "Microsoft JhengHei", -apple-system, sans-serif;
          font-size: 16px; font-weight: 500;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          display: flex; align-items: center; gap: 12px;
          animation: gg-fade-in 0.3s ease both, gg-fade-out 0.4s ease ${duration - 400}ms both;
        }
        .gg-eye { font-size: 22px; }
        .gg-title { color: ${color}; font-weight: 600; }
        .gg-sub { color: #9c9486; font-size: 13px; }
        .gg-marker {
          position: fixed; width: 90px; height: 90px;
          border: 3px solid ${color}; border-radius: 50%;
          box-shadow: 0 0 0 4px ${color}40, 0 0 24px ${color}66;
          animation: gg-pulse 0.8s ease-in-out infinite, gg-fade-out 0.4s ease ${duration - 400}ms both;
        }
        .gg-arrow {
          position: fixed; font-size: 48px; color: ${color};
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
          animation: gg-bob 0.7s ease-in-out infinite, gg-fade-out 0.4s ease ${duration - 400}ms both;
        }
      </style>
      <div class="gg-banner">
        <span class="gg-eye">👁</span>
        <span>
          <span class="gg-title">${titleText}</span><br>
          <span class="gg-sub">${subText}</span>
        </span>
      </div>
      ${markerHTML}
    `;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SHOW_OVERLAY") {
      console.log("[GazeGuard/Overlay] 收到 SHOW_OVERLAY，opts=", msg.opts);
      try {
        showOverlay(msg.info || {}, msg.opts || {});
        console.log("[GazeGuard/Overlay] 已呼叫 showOverlay，提示應已顯示");
        sendResponse({ shown: true });
      } catch (e) {
        console.error("[GazeGuard/Overlay] showOverlay 發生錯誤", e);
        sendResponse({ shown: false, error: String(e) });
      }
      return true;
    }
  });
  console.log("[GazeGuard/Overlay] content script 已就緒，監聽器已註冊");
})();
