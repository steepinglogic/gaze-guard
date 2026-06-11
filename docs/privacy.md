---
title: Gaze Guard — Privacy Policy
---

# Gaze Guard Privacy Policy

_Last updated: 2026-06-11_

---

## English

Gaze Guard is a Chrome extension that uses your webcam to detect whether an extra face is looking at your screen from within a configurable distance, and triggers a visual alert (and optional tab switch) when so. This document describes how the extension handles user data.

> One-line summary: **The extension does not collect, store, or upload any data, and makes no network requests at runtime.**

### 1. Data we collect

**None.** All processing runs locally on your machine:

- Webcam frames acquired via `getUserMedia` are fed to MediaPipe Face Landmarker for face detection. **Frames are never stored, never transmitted to any server.**
- Detection results (face count, distance estimate, head angles) live only in memory and are used to decide whether to trigger the alert. **They are never persisted to disk.**
- No PII, browsing history, tab URLs, or page contents are collected.

### 2. Local storage

The extension uses `chrome.storage.local` to persist your preferences on your browser only. **Nothing is synced to any cloud:**

- Trigger distance (cm), hold time (s), cooldown (s), yaw / pitch threshold, focal length calibration, extra-face threshold, action mode, overlay mode.

Clearing browser data or removing the extension permanently deletes these.

### 3. Network requests

**The extension makes no network requests at runtime.** All MediaPipe models and the WebAssembly runtime are bundled in the extension package and run fully offline after installation from the Chrome Web Store.

The only external link is when **you manually click** the "Support me on Ko-fi" button in the popup, which opens a new tab to `https://ko-fi.com/steepinglogic`. From there, Ko-fi's own privacy policy applies: <https://ko-fi.com/manage/privacypolicy>

### 4. Permissions

| Permission | Purpose |
|---|---|
| `tabs` | Switch to a user-configured safe tab when peeking is detected. |
| `scripting` | Inject the overlay alert into the active tab. |
| `notifications` | Surface a system notification when peeking is detected. |
| `offscreen` | Run the MediaPipe detection loop in a background document (service workers cannot access `getUserMedia`). |
| `storage` | Persist user preferences (see section 2). |
| `<all_urls>` host permission | The overlay must be able to render on whatever tab you happen to be viewing. **We do not read page contents** — we only insert a Shadow DOM container for the alert. |

### 5. Third-party components

This extension uses the following third-party open-source components. Licensing and source URLs are listed in [NOTICE.md](https://github.com/steepinglogic/gaze-guard/blob/main/NOTICE.md):

- MediaPipe Tasks Vision (JavaScript + WebAssembly runtime) — Apache 2.0
- MediaPipe Face Landmarker model — Apache 2.0

These components run **entirely locally** and do not report any data to Google or any third party.

### 6. Children's privacy

This extension does not target children under 13 and collects no data of any kind.

### 7. Changes to this policy

Future changes will update the "Last updated" date at the top. Material changes will be noted in the GitHub repository's release notes.

### 8. Contact

Open an issue on the GitHub repository: <https://github.com/steepinglogic/gaze-guard/issues>

Or email: steepinglogic@gmail.com

---

## 繁體中文 (zh-TW)

Gaze Guard 窺探守衛是一款 Chrome 擴充功能，當 webcam 偵測到一定距離內有額外的人臉時，會在當前分頁顯示視覺提醒並可選擇切換分頁。本文件說明本擴充功能如何處理使用者資料。

> 一句話結論：**本擴充功能不收集、不儲存、不上傳任何資料，也不在執行時發出任何網路請求。**

### 1. 我們收集的資料

**沒有。** 本擴充功能完全在你的本機執行：

- Webcam 影像由 `getUserMedia` 取得，傳入 MediaPipe Face Landmarker 進行人臉偵測，**影格從未被儲存、從未被傳輸到任何伺服器**。
- 偵測結果（人臉數量、距離估算、頭部角度）僅存在於記憶體中，用來判斷是否觸發提醒，**從未被儲存到磁碟**。
- 不蒐集任何個人識別資訊（PII）、不蒐集瀏覽紀錄、不蒐集分頁網址或內容。

### 2. 本地儲存

本擴充功能使用 `chrome.storage.local` 儲存以下「使用者偏好設定」於你的瀏覽器本機，**不會同步到任何雲端**：

- 觸發距離（公分）、持續時間門檻（秒）、冷卻秒數、頭部 yaw / pitch 容許角度、焦距校正值、額外人臉門檻、動作模式、Overlay 視覺模式。

清除瀏覽器資料或移除擴充功能即可永久刪除這些設定。

### 3. 網路請求

**本擴充功能在執行時不會發出任何網路請求。** 所有 MediaPipe 模型與 WebAssembly runtime 都已打包在擴充功能本體中，從 Chrome Web Store 安裝後即離線運作。

唯一的外連是當使用者**主動點擊** popup 內的「Support me on Ko-fi」按鈕時，會開新分頁前往 `https://ko-fi.com/steepinglogic`。此後的資料處理由 Ko-fi 自身的隱私政策接管：<https://ko-fi.com/manage/privacypolicy>

### 4. 權限說明

| 權限 | 用途 |
|---|---|
| `tabs` | 在偵測到偷看時，切換到使用者預先指定的安全分頁 |
| `scripting` | 將視覺提醒 overlay 注入當前分頁 |
| `notifications` | 顯示系統通知 |
| `offscreen` | 在背景文件中執行 MediaPipe 偵測迴圈（service worker 無法存取 `getUserMedia`） |
| `storage` | 儲存使用者設定（見第 2 節） |
| `<all_urls>` host permission | overlay 必須能注入「使用者當前看的分頁」，無法事先收斂。**我們不會讀取頁面內容**，僅插入一個 Shadow DOM 容器用於顯示提醒。 |

### 5. 第三方元件

本擴充功能使用以下第三方開源元件，授權與來源列於 [NOTICE.md](https://github.com/steepinglogic/gaze-guard/blob/main/NOTICE.md)：

- MediaPipe Tasks Vision (JavaScript + WebAssembly runtime) — Apache 2.0
- MediaPipe Face Landmarker model — Apache 2.0

這些元件**完全在本機執行**，不會回傳資料給 Google 或任何第三方。

### 6. 兒童隱私

本擴充功能不主動針對 13 歲以下兒童，也不蒐集任何資料。

### 7. 政策變更

未來如有變更，將更新本頁面頂端的 "Last updated" 日期。重大變更會在 GitHub repo 的 release notes 中註明。

### 8. 聯絡方式

於 GitHub repo 開 issue：<https://github.com/steepinglogic/gaze-guard/issues>

或寄信至：steepinglogic@gmail.com
