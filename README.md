# ESP32 Web Flash & Serial Monitor

Web application for flashing firmware to ESP32 boards and monitoring serial communication directly from the browser using the Web Serial API.

## Requirements

- **Node.js** 18+
- **Chrome 89+** or **Edge 89+** (Web Serial API required)
- ESP32 board connected via USB

## Setup

```bash
cd server
npm install
```

## Running

```bash
# Development (auto-restart on changes)
cd server
npm run dev

# Production
cd server
npm start
```

The server starts on `http://localhost:3000` (or `PORT` env variable).

## Adding Firmware

1. Place `.bin` files in the `firmware/` directory
2. Edit `server/firmwares.json` to add entries:

```json
{
  "id": "my-firmware-v1.0",
  "name": "My Firmware v1.0",
  "description": "Description of the firmware",
  "file": "firmware/my-firmware-v1.0.bin",
  "chip": "ESP32",
  "flashOffset": "0x0",
  "baudRate": 921600
}
```

Supported chips: `ESP32`, `ESP32-S2`, `ESP32-S3`, `ESP32-C3`, `ESP32-C6`, `ESP32-H2`

## Usage

1. Open `http://localhost:3000` in Chrome/Edge
2. **Flash tab**: Select firmware, click "Connect ESP32", then "Flash"
3. **Monitor tab**: Select baud rate, click "Connect" to start serial monitor

## Project Structure

```
├── server/
│   ├── index.js           # Express server
│   ├── package.json
│   └── firmwares.json     # Firmware configuration
├── firmware/              # .bin firmware files
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js         # Main orchestrator
│   │   ├── serial.js      # Web Serial API abstraction
│   │   ├── flasher.js     # esptool-js wrapper
│   │   └── monitor.js     # Serial monitor
│   └── lib/
│       └── esptool-bundle.js  # Vendored esptool-js
└── README.md
```

## Production Deployment

Use a reverse proxy (nginx) with SSL for HTTPS (required by Web Serial API outside localhost):

```bash
# Process management
pm2 start server/index.js --name esp32-web-tool

# Or systemd
```
