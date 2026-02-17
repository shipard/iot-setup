import express from 'express';
import { readFileSync, createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const FIRMWARES_PATH = join(__dirname, 'firmwares.json');
const ROOT_DIR = join(__dirname, '..');

function loadFirmwares() {
  const data = readFileSync(FIRMWARES_PATH, 'utf-8');
  return JSON.parse(data).firmwares;
}

// Serve static files from public/
app.use(express.static(join(ROOT_DIR, 'public')));

// GET /api/firmwares - list available firmwares (without file path)
app.get('/api/firmwares', (req, res) => {
  try {
    const firmwares = loadFirmwares().map(({ file, ...rest }) => rest);
    res.json({ firmwares });
  } catch (err) {
    console.error('Error reading firmwares.json:', err.message);
    res.status(500).json({ error: 'Failed to load firmware list' });
  }
});

// GET /api/firmware/:id - download firmware binary
app.get('/api/firmware/:id', (req, res) => {
  try {
    const firmwares = loadFirmwares();
    const firmware = firmwares.find(fw => fw.id === req.params.id);

    if (!firmware) {
      return res.status(404).json({ error: 'Firmware not found' });
    }

    const filePath = join(ROOT_DIR, firmware.file);

    if (!existsSync(filePath)) {
      console.error(`Firmware file missing: ${filePath}`);
      return res.status(500).json({ error: 'Firmware file not found on disk' });
    }

    console.log(`Serving firmware: ${firmware.id} (${firmware.file})`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${firmware.id}.bin"`);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error serving firmware:', err.message);
    res.status(500).json({ error: 'Failed to serve firmware' });
  }
});

app.listen(PORT, () => {
  console.log(`ESP32 Web Tool server running on http://localhost:${PORT}`);
});
