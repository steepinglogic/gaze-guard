// offscreen.js
// 在隱藏的 offscreen document 中執行攝影機擷取與 MediaPipe 人臉偵測。
// 偵測「在一定距離內、正面朝向鏡頭、持續一段時間」的人臉，
// 達標時透過訊息通知 background service worker。

import {
  FaceLandmarker,
  FilesetResolver,
} from "./vendor/vision_bundle.mjs";

const video = document.getElementById("cam");
const canvas = document.getElementById("work");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let faceLandmarker = null;
let stream = null;
let running = false;
let rafId = null;

// 預設設定，會被 storage 中的使用者設定覆蓋
let settings = {
  triggerDistanceCm: 80,   // 觸發距離：臉部比此距離更近就算「靠近」
  holdSeconds: 2.5,        // 需持續注視幾秒才觸發
  cooldownSeconds: 20,     // 觸發後幾秒內不再重複觸發
  yawThreshold: 22,        // 左右偏轉角度容許值（度），越小越要求正面
  pitchThreshold: 22,      // 上下偏轉角度容許值（度）
  focalLengthPx: 650,      // 攝影機焦距（像素），可校正
  extraFaceThreshold: 1,   // 需要幾張「額外」的注視臉孔才觸發。
                           // 0 = 任何符合條件的臉就觸發（含自己）
                           // 1 = 除了自己，還要有第 2 張臉（建議值）
};

// 估算用：成人雙眼間距平均約 6.3 cm（瞳距）
const REAL_EYE_DISTANCE_CM = 6.3;

// 狀態追蹤
let gazeStartTime = null;     // 開始「符合注視條件」的時間
let lastTriggerTime = 0;      // 上次觸發的時間
let lastReportTime = 0;       // 上次回報狀態給 popup 的時間

// 從 background 取得設定（offscreen 無法直接存取 chrome.storage）
async function loadSettings() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "OFFSCREEN_GET_SETTINGS" });
    if (resp && resp.gazeSettings) {
      settings = { ...settings, ...resp.gazeSettings };
    }
  } catch (e) {
    console.warn("讀取設定失敗，使用預設值", e);
  }
}

// 初始化 MediaPipe FaceLandmarker
async function initModel() {
  // WASM 從 extension 本機載入（已打包，符合 CSP）
  const wasmPath = chrome.runtime.getURL("wasm");
  const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);

  const modelPath = chrome.runtime.getURL("models/face_landmarker.task");

  async function build(delegate) {
    return await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 5,
    });
  }

  try {
    faceLandmarker = await build("GPU");
  } catch (e) {
    console.warn("GPU delegate 失敗，改用 CPU", e);
    faceLandmarker = await build("CPU");
  }
}

// 啟動攝影機
async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

// 從變換矩陣中萃取 yaw / pitch（近似）
function extractYawPitch(matrix) {
  // matrix 是 4x4 column-major，data 為長度 16 的陣列
  const m = matrix.data;
  // 旋轉部分元素
  const r00 = m[0], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r22 = m[10];
  const yaw = Math.atan2(r02, r22) * (180 / Math.PI);
  const pitch = Math.atan2(-r12, Math.sqrt(r10 * r10 + r11 * r11)) * (180 / Math.PI);
  return { yaw, pitch };
}

// 用雙眼間距估算距離（公分）
function estimateDistanceCm(landmarks) {
  // MediaPipe face landmark 索引：左眼外角 33、右眼外角 263（或用瞳孔 468/473）
  // 使用兩眼內角較穩定：左眼內角 133、右眼內角 362
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  if (!leftEye || !rightEye) return null;

  const dxPx = (rightEye.x - leftEye.x) * canvas.width;
  const dyPx = (rightEye.y - leftEye.y) * canvas.height;
  const eyeDistPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
  if (eyeDistPx <= 0) return null;

  // 針孔模型：distance = (real_size * focal_length) / pixel_size
  // 此處 REAL_EYE_DISTANCE_CM 用兩眼外角間距約 9 cm 較合理，但這裡用瞳距近似
  const realCm = 9.0; // 兩眼外角間距平均約 9 cm
  const distCm = (realCm * settings.focalLengthPx) / eyeDistPx;
  return distCm;
}

// 主迴圈
let lastLogTime = 0;
function loop() {
  if (!running) return;

  try {
    if (video.readyState >= 2 && faceLandmarker) {
      const now = performance.now();
      const result = faceLandmarker.detectForVideo(video, now);

      let triggerCondition = false;
      let info = { faceFound: false };

      const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;

      if (faceCount > 0) {
        // 逐一分析每張臉，算出哪些「正在注視」（夠近 + 正面）
        const faces = [];
        for (let i = 0; i < faceCount; i++) {
          const landmarks = result.faceLandmarks[i];
          const distCm = estimateDistanceCm(landmarks);

          let yaw = 0, pitch = 0;
          const mtx = result.facialTransformationMatrixes?.[i];
          if (mtx) {
            const angles = extractYawPitch(mtx);
            yaw = angles.yaw;
            pitch = angles.pitch;
          }

          const facingCamera =
            Math.abs(yaw) <= settings.yawThreshold &&
            Math.abs(pitch) <= settings.pitchThreshold;
          const isClose = distCm != null && distCm <= settings.triggerDistanceCm;
          const watching = facingCamera && isClose;

          let minX = 1, minY = 1, maxX = 0, maxY = 0;
          for (const p of landmarks) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const faceBox = {
            cx: 1 - (minX + maxX) / 2, // 水平鏡像
            cy: (minY + maxY) / 2,
            w: maxX - minX,
            h: maxY - minY,
          };

          faces.push({ distCm, yaw, pitch, facingCamera, isClose, watching, faceBox });
        }

        // 計算「正在注視」的臉數量
        const watchingFaces = faces.filter((f) => f.watching);
        const watchingCount = watchingFaces.length;

        // 觸發條件：注視中的臉數 > extraFaceThreshold
        // threshold=0 → 任何注視臉就觸發；threshold=1 → 要 2 張（自己+別人）
        triggerCondition = watchingCount > settings.extraFaceThreshold;

        // 標示用的臉：挑「最遠的注視臉」當作代表（用於顯示距離文字）
        let markFace = watchingFaces[0] || faces[0];
        if (watchingFaces.length > 1) {
          markFace = watchingFaces.reduce((a, b) =>
            (b.distCm || 0) > (a.distCm || 0) ? b : a
          );
        }

        info = {
          faceFound: true,
          faceCount,
          watchingCount,
          extraFaceThreshold: settings.extraFaceThreshold,
          distanceCm: markFace.distCm ? Math.round(markFace.distCm) : null,
          yaw: Math.round(markFace.yaw),
          pitch: Math.round(markFace.pitch),
          facingCamera: markFace.facingCamera,
          isClose: markFace.isClose,
          watching: triggerCondition,
          faceBox: markFace.faceBox,
          faceBoxes: watchingFaces.length > 0
            ? watchingFaces.map((f) => f.faceBox)
            : [markFace.faceBox],
        };
      }

      // 處理「持續滿足觸發條件」狀態機
      const nowMs = Date.now();
      if (triggerCondition) {
        if (gazeStartTime === null) gazeStartTime = nowMs;
        const heldSec = (nowMs - gazeStartTime) / 1000;
        info.heldSeconds = Math.round(heldSec * 10) / 10;

        const sinceLastTrigger = (nowMs - lastTriggerTime) / 1000;
        if (
          heldSec >= settings.holdSeconds &&
          sinceLastTrigger >= settings.cooldownSeconds
        ) {
          lastTriggerTime = nowMs;
          gazeStartTime = null;
          console.log("[GazeGuard] ★ 觸發！發送 GAZE_TRIGGER 給 background", info);
          chrome.runtime.sendMessage({ type: "GAZE_TRIGGER", info }).catch((e) => {
            console.warn("[GazeGuard] 發送 GAZE_TRIGGER 失敗", e);
          });
        }
      } else {
        gazeStartTime = null;
        info.heldSeconds = 0;
      }

      // 每秒在 console 印一次偵測狀態（debug 用）
      if (now - lastLogTime > 1000) {
        lastLogTime = now;
        if (info.faceFound) {
          console.log(
            `[GazeGuard] 臉數=${info.faceCount} 注視中=${info.watchingCount} 門檻=${info.extraFaceThreshold} | 標示臉距離≈${info.distanceCm}cm | 觸發條件=${triggerCondition}`
          );
        } else {
          console.log("[GazeGuard] 迴圈執行中，但這一幀沒偵測到人臉");
        }
      }

      // 每 ~300ms 回報一次即時狀態給 popup（如果有開）
      if (now - lastReportTime > 300) {
        lastReportTime = now;
        chrome.runtime.sendMessage({ type: "GAZE_STATUS", info }).catch(() => {});
      }
    } else {
      // video 還沒準備好或模型還沒載入
      const now = performance.now();
      if (now - lastLogTime > 1000) {
        lastLogTime = now;
        console.log(
          `[GazeGuard] 等待中：video.readyState=${video.readyState}, 模型已載入=${!!faceLandmarker}`
        );
      }
    }
  } catch (e) {
    console.error("[GazeGuard] 偵測迴圈發生錯誤：", e);
  }

  // 隱藏的 offscreen document 中 requestAnimationFrame 會被瀏覽器節流/凍結，
  // 改用 setTimeout 確保背景持續執行。約 100ms 一次（10 FPS）足夠且省電。
  rafId = setTimeout(loop, 100);
}

async function start() {
  if (running) return;
  console.log("[GazeGuard] start() 開始");
  await loadSettings();
  console.log("[GazeGuard] 設定已載入：", JSON.stringify(settings));
  if (!faceLandmarker) {
    console.log("[GazeGuard] 開始載入模型…");
    await initModel();
    console.log("[GazeGuard] 模型載入完成");
  }
  console.log("[GazeGuard] 開始啟動攝影機…");
  await startCamera();
  console.log(
    `[GazeGuard] 攝影機已啟動，解析度 ${video.videoWidth}x${video.videoHeight}`
  );
  running = true;
  loop();
  chrome.runtime.sendMessage({ type: "GAZE_STARTED" }).catch(() => {});
}

function stop() {
  running = false;
  if (rafId) clearTimeout(rafId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  gazeStartTime = null;
  chrome.runtime.sendMessage({ type: "GAZE_STOPPED" }).catch(() => {});
}

// 接收來自 background 的指令
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "START") {
    start()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.error("啟動失敗", e);
        chrome.runtime
          .sendMessage({ type: "GAZE_ERROR", error: String(e) })
          .catch(() => {});
        sendResponse({ ok: false, error: String(e) });
      });
    return true;
  }
  if (msg.type === "STOP") {
    stop();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "RELOAD_SETTINGS") {
    loadSettings().then(() => sendResponse({ ok: true }));
    return true;
  }
});
