# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 Web Flash & Serial Monitor — a web app for flashing firmware to ESP32 boards and monitoring serial communication. All ESP32 communication happens in the browser via Web Serial API; the server only serves static files and firmware metadata.

UI supports Czech and English localization. Default language is detected from the browser (`navigator.language`), persisted in `localStorage` key `esp32tool_lang`. A language selector dropdown (`<select id="lang-select">`) in the header allows switching at runtime without page reload.

## Commands

```bash
# Install dependencies
cd server && npm install

# Run dev server (auto-restart on changes)
cd server && npm run dev

# Run production server
cd server && npm start
```

Server runs on `http://localhost:3000` (override with `PORT` env var).

## Architecture

**No build step.** Frontend uses native ES modules (`type="module"`). Chrome 89+ required for Web Serial API.

### Server (`server/`)
Minimal Express server (ESM). Serves `../public` as static files. Two API endpoints:
- `GET /api/firmwares` — returns firmware list from `firmwares.json` (strips `file` field)
- `GET /api/firmware/:id` — streams `.bin` from `firmware/` directory

### Frontend (`public/js/`)
Five ES modules with a single shared `SerialManager` instance:

- **`serial.js`** — `SerialManager` class: Web Serial API abstraction, single shared port between flash and monitor modes. Tracks mode (`idle`/`monitor`/`flash`).
- **`flasher.js`** — `Flasher` class: wraps vendored esptool-js. Creates `Transport` from raw `SerialPort`, uses `ESPLoader` for chip detection and `writeFlash()`. Takes the port directly from `SerialManager.getPort()`.
- **`monitor.js`** — `Monitor` class: serial reading/writing, auto-scroll, command history (arrow keys), line endings, output colorization.
- **`app.js`** — Main orchestrator: tab switching, firmware loading, wires all modules together, handles port sharing (auto-stops monitor before flash, auto-restarts after).
- **`i18n.js`** — Localization module: translation dictionaries for `cs`/`en`, exports `t(key, vars)`, `setLanguage(lang)`, `currentLang()`. Applies translations via `[data-i18n]` and `[data-i18n-placeholder]` DOM attributes. Dispatches `CustomEvent('languagechange')` on switch.

### Port sharing pattern
`SerialManager` holds one port. During flashing, esptool-js owns the port via `Transport(port)`. During monitoring, `SerialManager` manages read/write. `app.js` coordinates handoff — stops monitor before flash, restarts it after with a 500ms delay for ESP32 boot.

### Vendored dependency
`public/lib/esptool-bundle.js` — vendored esptool-js ESM bundle (from npm `esptool-js`). Exports `ESPLoader`, `Transport`, etc.

## Firmware Configuration

`server/firmwares.json` defines available firmwares. Binary `.bin` files go in `firmware/`. Each entry has: `id`, `name`, `description`, `file` (path to .bin), `chip`, `flashOffset`, `baudRate`.
