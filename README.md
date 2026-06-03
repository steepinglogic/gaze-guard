# Gaze Guard 窺探守衛

偵測到有人從遠端盯著你的螢幕時，自動顯示視覺提示或切換到指定分頁。  
所有影像分析在瀏覽器本機完成，**畫面與人臉資料不會離開你的電腦**。

---

## 功能特色

- **本地端 AI 偵測** — 使用 MediaPipe FaceLandmarker（Google 開源模型），透過 WebAssembly 在本機運行，支援 GPU 加速
- **距離估算** — 針孔相機模型估算對方與螢幕的距離（cm）
- **頭部朝向判斷** — 偵測 yaw / pitch 角度，只在對方正面注視時觸發
- **兩種視覺提示**：邊框順時針跑光動畫 / 標示人臉位置 popup
- **自動切換分頁** — 觸發時跳到預設的安全分頁
- **可調整靈敏度** — 距離、持續時間、冷卻、角度容許範圍全部可設定

---

## 安裝方式（開發者模式載入）

> Chrome Web Store 上架前，使用「載入未封裝項目」方式安裝。

1. 下載或 clone 此 repo：
   ```bash
   git clone https://github.com/your-username/gaze-guard.git
   ```

2. 開啟 Chrome，網址列輸入：
   ```
   chrome://extensions
   ```

3. 右上角開啟 **「開發人員模式」**

4. 點擊 **「載入未封裝項目」**，選擇 `gaze-guard` 資料夾

5. 擴充功能列會出現 Gaze Guard 圖示

---

## 使用方式

### 首次啟動

1. 點擊工具列的 Gaze Guard 圖示，開啟 popup
2. 點擊右上角 **「啟動」** 按鈕
3. 第一次使用時，瀏覽器會跳出攝影機權限請求頁面 → 點擊允許
4. 狀態列變成綠色「偵測中」，表示正在運作

### 設定目標分頁

切換到想要躲避的「安全分頁」（例如一個假的工作頁面），然後：
1. 回到任意分頁，開啟 Gaze Guard popup
2. 點擊 **「把目前分頁設為目標」**  
   ※ 需先切換到安全分頁，再重新開啟 popup 設定

觸發時會自動切換到此分頁。

### 觸發條件

滿足以下所有條件且持續指定秒數，才會觸發提示：

| 條件 | 說明 |
|------|------|
| 偵測到額外臉孔 | 預設需 **第 2 張臉**（排除自己），可設為 0 表示任何臉 |
| 距離在範圍內 | 預設 **80 cm 以內** |
| 正面朝向鏡頭 | yaw / pitch 各在 **±22°** 以內 |
| 持續注視 | 預設 **2.5 秒** |

觸發後進入冷卻期（預設 20 秒），期間不會再次觸發。

---

## 設定說明

### 觸發後動作

| 選項 | 說明 |
|------|------|
| 畫面提示 + 切換分頁 | 先顯示提示動畫，時間到後切換分頁（推薦） |
| 只顯示畫面提示 | 僅在當前分頁顯示動畫，不切換 |
| 只切換分頁 | 靜默切換，無動畫 |

### 提示方式

| 選項 | 說明 |
|------|------|
| 邊框順時針跑光 | SVG 發光邊框繞螢幕一圈，有三層 blur 光暈 |
| 標示人臉位置 | 頂部 banner + 圓形標記指向偵測到的臉部位置 |

顏色可選：金色 / 青綠色 / 紅色  
顯示時間：500 ~ 5000 ms

### 偵測參數

| 參數 | 預設值 | 說明 |
|------|--------|------|
| 額外臉孔門檻 | 1 | 需幾張「額外」臉才觸發；設 1 表示要有第 2 人才提醒 |
| 觸發距離 | 80 cm | 超過此距離的臉不觸發 |
| 持續注視 | 2.5 s | 持續符合條件幾秒後才觸發 |
| 冷卻時間 | 20 s | 觸發後幾秒內不再觸發 |
| 正面容許角度 | ±22° | 頭部偏轉幾度以內才算「正在看」 |
| 距離校正（焦距）| 650 px | 若距離顯示偏差，調整此值校正；數值越大估算距離越遠 |

---

## 專案架構

### 技術棧

- **Chrome Extension Manifest V3**（Vanilla JavaScript，無 build system）
- **MediaPipe FaceLandmarker**（Google 開源，WASM 本機執行）
- **WebAssembly**（`wasm/`）+ GPU delegate 加速，失敗自動降回 CPU

### 檔案結構

```
gaze-guard/
├── manifest.json          # 擴充功能設定、權限宣告
├── background.js          # Service Worker：orchestrator，管理各元件生命週期
├── offscreen.html/js      # 背景頁面：攝影機捕捉 + 人臉偵測迴圈
├── popup.html/js          # Popup UI：設定介面、即時狀態顯示
├── overlay.js             # Content Script：注入當前分頁顯示視覺提示
├── permission.html/js     # 一次性攝影機授權頁面
├── models/
│   └── face_landmarker.task   # MediaPipe 人臉模型（3.6 MB）
├── vendor/
│   └── vision_bundle.mjs      # MediaPipe JS SDK
└── wasm/                  # WebAssembly 執行環境（含 SIMD / no-SIMD 版本）
```

### 元件關係

```
popup.js
  ↕ chrome.runtime.sendMessage
background.js (Service Worker)  ←──────────────┐
  ↕ chrome.runtime.sendMessage                  │
offscreen.js (攝影機 + 偵測迴圈)  ──GAZE_TRIGGER──┘
                                                │
                          ┌─────────────────────┘
                          ↓ chrome.scripting.executeScript
                       overlay.js（注入當前分頁）
```

### 偵測流程

```
攝影機影格（640×480, ~10 FPS）
  → MediaPipe 取得 468 個人臉特徵點
  → 計算眼距 → 估算距離（cm）
  → 計算 yaw / pitch（頭部朝向）
  → 條件判斷（距離 + 角度 + 臉孔數）
  → 持續計時 → 超過門檻 → GAZE_TRIGGER
  → background.js handleTrigger()
     → 注入 overlay.js 顯示動畫
     → 切換分頁（依設定）
```

### 關鍵設計決策

- **offscreen document**：MV3 Service Worker 無法直接存取攝影機，透過隱藏的 offscreen 頁面捕捉影像
- **permission.html**：offscreen 無法觸發瀏覽器權限 dialog，需獨立的可見頁面來請求攝影機授權
- **Shadow DOM**：`overlay.js` 用 Shadow DOM 隔離 CSS，避免被當前頁面的樣式干擾
- **setTimeout 迴圈**：背景 context 不支援 `requestAnimationFrame`，改用 `setTimeout` 實現約 10 FPS 的偵測迴圈

---

## 隱私聲明

- 攝影機影像**僅在本機處理**，不傳送至任何伺服器
- 人臉模型（`face_landmarker.task`）已隨擴充功能打包，不需連線下載
- `manifest.json` 中的 `https://storage.googleapis.com/*` 權限為備用 fallback，正常運作不使用
