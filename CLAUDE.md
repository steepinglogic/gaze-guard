# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gaze Guard 窺探守衛** — Chrome MV3 extension that detects when someone is looking at your screen from a distance via webcam. All processing is local; no video frames leave the device.

## Development

No build system. Load directly as unpacked extension:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select this folder

After modifying JS/HTML: reload the extension from `chrome://extensions` (background.js changes require full reload; popup.js changes only require reopening popup).

No npm, no Makefile, no test runner, no linter.

## Architecture

Five distinct runtime contexts communicate via `chrome.runtime.sendMessage`:

```
popup.js          ←→  background.js (service worker)  ←→  offscreen.js
                            ↓
                       overlay.js (injected content script)
                       permission.js (one-time camera grant)
```

### background.js — Orchestrator
Manages the offscreen document lifecycle, routes messages between popup ↔ offscreen, handles camera permission flow, and executes trigger actions (inject overlay + switch tab). Key function: `handleTrigger()`.

### offscreen.js — Face Detection Loop
Runs ~10 FPS detection loop using MediaPipe FaceLandmarker (bundled WASM). For each frame:
1. Extracts 468 face landmarks per face
2. Estimates distance via pinhole camera model: `distance = (9.0cm × focalLength_px) / eyeDistance_px`
3. Computes head pose (yaw/pitch) from transformation matrix
4. State machine: watching → hold timer → GAZE_TRIGGER → cooldown

Uses `setTimeout` (not `requestAnimationFrame`) because offscreen documents are background contexts.

### popup.js — Settings Dashboard
All settings persisted to `chrome.storage.local`. Key settings object:
```js
gazeSettings: { triggerDistanceCm, holdSeconds, cooldownSeconds, yawThreshold, pitchThreshold, focalLengthPx, extraFaceThreshold }
actionMode: "notify_and_switch" | "overlay_only" | "switch_only"
overlayMode: "border" | "marker"
```

### overlay.js — Visual Alert (Content Script)
Injected into active tab on trigger. Uses Shadow DOM for CSS isolation. Two modes:
- `buildBorder()` — SVG edge glow with Gaussian blur, dashed stroke animation
- `buildMarker()` — top banner + circular face marker with pulse animation

Guards against double-injection via `window.__gazeGuardOverlayInstalled`.

### permission.html/permission.js — Camera Permission Broker
Offscreen documents cannot show browser permission dialogs, so background opens this visible page when `cameraGranted` flag is unset. Sends `PERMISSION_GRANTED` to background then auto-closes.

## Key Design Constraints

- **WASM-unsafe-eval**: `manifest.json` CSP must include `'wasm-unsafe-eval'` for MediaPipe to run.
- **offscreen document limit**: Chrome MV3 allows only one offscreen document at a time. `background.js` checks existence before creating.
- **GPU/CPU fallback**: MediaPipe initialized with `delegate: "GPU"`, falls back to `"CPU"` on failure.
- **`extraFaceThreshold: 1`** means "trigger only when ≥2 faces detected" (excludes the user themselves). Default recommended setting.
- **Local model path**: `models/face_landmarker.task` loaded via `chrome.runtime.getURL()`. No CDN fallback.

## Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `POPUP_START` | popup → background | User starts monitoring |
| `POPUP_STOP` | popup → background | User stops monitoring |
| `START` / `STOP` | background → offscreen | Start/stop detection loop |
| `GAZE_STATUS` | offscreen → background → popup | Real-time detection data |
| `GAZE_TRIGGER` | offscreen → background | Gaze condition met |
| `SHOW_OVERLAY` | background → overlay.js | Display visual alert |
| `PERMISSION_GRANTED` | permission.js → background | Camera access confirmed |
| `RELOAD_SETTINGS` | background → offscreen | Settings changed in popup |
