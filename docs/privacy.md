---
title: Gaze Guard — Privacy Policy
---

# Gaze Guard Privacy Policy

_Last updated: 2026-06-11_

Gaze Guard 窺探守衛（以下稱「本擴充功能」）是一款 Chrome 擴充功能，當 webcam 偵測到一定距離內有額外的人臉時，會在當前分頁顯示視覺提醒並可選擇切換分頁。本文件說明本擴充功能如何處理使用者資料。

> 一句話結論：**本擴充功能不收集、不儲存、不上傳任何資料，也不在執行時發出任何網路請求。**

---

## 1. 我們收集的資料

**沒有。**

本擴充功能完全在你的本機執行：
- Webcam 影像由 `getUserMedia` 取得，傳入 MediaPipe Face Landmarker 進行人臉偵測，**影格從未被儲存、從未被傳輸到任何伺服器**。
- 偵測結果（人臉數量、距離估算、頭部角度）僅存在於記憶體中，用來判斷是否觸發提醒，**從未被儲存到磁碟**。
- 不蒐集任何個人識別資訊（PII）、不蒐集瀏覽紀錄、不蒐集分頁網址或內容。

## 2. 本地儲存

本擴充功能使用 `chrome.storage.local` 儲存以下「使用者偏好設定」於你的瀏覽器本機，**不會同步到任何雲端**：

- 觸發距離（公分）
- 持續時間門檻（秒）
- 冷卻秒數
- 頭部 yaw / pitch 容許角度
- 焦距校正值
- 額外人臉門檻
- 動作模式（通知 / overlay / 切換分頁）
- Overlay 視覺模式（border / marker）

清除瀏覽器資料或移除擴充功能即可永久刪除這些設定。

## 3. 網路請求

**本擴充功能在執行時不會發出任何網路請求。** 所有 MediaPipe 模型與 WebAssembly runtime 都已打包在擴充功能本體中，從 Chrome Web Store 安裝後即離線運作。

唯一的外連是當使用者**主動點擊 popup 內的「Support me on Ko-fi」按鈕**時，會開新分頁前往 `https://ko-fi.com/steepinglogic`。此後的資料處理由 Ko-fi 自身的隱私政策接管：https://ko-fi.com/manage/privacypolicy

## 4. 權限說明

| 權限 | 用途 |
|---|---|
| `tabs` | 在偵測到偷看時，切換到使用者預先指定的安全分頁 |
| `scripting` | 將視覺提醒 overlay 注入當前分頁 |
| `notifications` | 顯示系統通知 |
| `offscreen` | 在背景文件中執行 MediaPipe 偵測迴圈（service worker 無法存取 `getUserMedia`） |
| `storage` | 儲存使用者設定（見第 2 節） |
| `<all_urls>` host permission | 因為「使用者當前看的分頁」可能是任何網站，overlay 必須能注入任何 URL。**我們不會讀取頁面內容、不會修改頁面 DOM 以外的行為**，僅插入一個 Shadow DOM 容器用於顯示提醒。 |

## 5. 第三方元件

本擴充功能使用以下第三方開源元件，授權與來源列於 [NOTICE.md](https://github.com/steepinglogic/gaze-guard/blob/main/NOTICE.md)：

- MediaPipe Tasks Vision (JavaScript + WebAssembly runtime) — Apache 2.0
- MediaPipe Face Landmarker model — Apache 2.0

這些元件在本機執行，**不會回傳資料給 Google 或任何第三方**。

## 6. 兒童隱私

本擴充功能不主動針對 13 歲以下兒童，也不蒐集任何資料。

## 7. 政策變更

未來如有變更，將更新本頁面頂端的 "Last updated" 日期。重大變更會在 GitHub repo 的 release notes 中註明。

## 8. 聯絡方式

如對本隱私政策有疑問，請開 issue 於 GitHub repo：
https://github.com/steepinglogic/gaze-guard/issues

或寄信至：steepinglogic@gmail.com
