import { SerialManager } from './serial.js';
import { Flasher } from './flasher.js';
import { Monitor } from './monitor.js';

// ── Elements ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

const els = {
  browserWarning: $('#browser-warning'),
  connectionStatus: $('#connection-status'),
  connectionText: $('#connection-text'),
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabFlash: $('#tab-flash'),
  tabMonitor: $('#tab-monitor'),
  // Flash
  firmwareSelect: $('#firmware-select'),
  firmwareDescription: $('#firmware-description'),
  connectFlashBtn: $('#connect-flash-btn'),
  flashBtn: $('#flash-btn'),
  flashProgressContainer: $('#flash-progress-container'),
  flashProgress: $('#flash-progress'),
  flashProgressText: $('#flash-progress-text'),
  flashLog: $('#flash-log'),
  // Monitor
  baudRate: $('#baud-rate'),
  lineEnding: $('#line-ending'),
  connectMonitorBtn: $('#connect-monitor-btn'),
  clearMonitorBtn: $('#clear-monitor-btn'),
  copyMonitorBtn: $('#copy-monitor-btn'),
  monitorOutput: $('#monitor-output'),
  monitorInput: $('#monitor-input'),
  sendBtn: $('#send-btn'),
};

// ── State ─────────────────────────────────────────────────
const serial = new SerialManager();
const flasher = new Flasher(serial);
let monitor = null;
let firmwares = [];
let isFlashing = false;
let monitorWasRunning = false;

// ── Browser check ─────────────────────────────────────────
if (!('serial' in navigator)) {
  els.browserWarning.hidden = false;
}

// ── Tab switching ─────────────────────────────────────────
els.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    els.tabFlash.classList.toggle('active', tab === 'flash');
    els.tabMonitor.classList.toggle('active', tab === 'monitor');
  });
});

// ── Connection status ─────────────────────────────────────
function updateConnectionStatus(state, text) {
  els.connectionStatus.className = `connection-status ${state}`;
  els.connectionText.textContent = text || {
    disconnected: 'Odpojeno',
    connected: 'Připojeno',
    flashing: 'Nahrávání...',
  }[state] || state;
}

serial.onConnect = () => updateConnectionStatus('connected', 'Připojeno');
serial.onDisconnect = () => {
  updateConnectionStatus('disconnected', 'Odpojeno');
  updateMonitorUI(false);
  if (isFlashing) {
    flashLog('USB odpojeno během flashování!', 'error');
  }
};

// ── Firmware list ─────────────────────────────────────────
async function loadFirmwares() {
  try {
    const res = await fetch('/api/firmwares');
    const data = await res.json();
    firmwares = data.firmwares;

    els.firmwareSelect.innerHTML = '<option value="">-- Vyberte firmware --</option>';
    firmwares.forEach(fw => {
      const opt = document.createElement('option');
      opt.value = fw.id;
      opt.textContent = `${fw.name} (${fw.chip})`;
      els.firmwareSelect.appendChild(opt);
    });
    els.firmwareSelect.disabled = false;
  } catch (e) {
    els.firmwareSelect.innerHTML = '<option value="">Chyba načítání</option>';
    console.error('Failed to load firmwares:', e);
  }
}

els.firmwareSelect.addEventListener('change', () => {
  const fw = firmwares.find(f => f.id === els.firmwareSelect.value);
  if (fw?.description) {
    els.firmwareDescription.textContent = fw.description;
    els.firmwareDescription.hidden = false;
  } else {
    els.firmwareDescription.hidden = true;
  }
  updateFlashButton();
});

// ── Flash tab ─────────────────────────────────────────────
function updateFlashButton() {
  els.flashBtn.disabled = !serial.hasPort || !els.firmwareSelect.value || isFlashing;
}

function flashLog(msg, cls) {
  const el = els.flashLog;
  if (cls) {
    const span = document.createElement('span');
    span.className = `log-${cls}`;
    span.textContent = msg + '\n';
    el.appendChild(span);
  } else {
    el.appendChild(document.createTextNode(msg + '\n'));
  }
  el.scrollTop = el.scrollHeight;
}

els.connectFlashBtn.addEventListener('click', async () => {
  try {
    await serial.requestPort();
    updateFlashButton();
    updateConnectionStatus('connected', 'Připojeno');
    els.connectFlashBtn.textContent = 'Port vybrán';
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      flashLog(`Chyba připojení: ${e.message}`, 'error');
    }
  }
});

els.flashBtn.addEventListener('click', async () => {
  const fw = firmwares.find(f => f.id === els.firmwareSelect.value);
  if (!fw) return;

  isFlashing = true;
  updateFlashButton();
  els.flashLog.textContent = '';
  els.flashProgressContainer.hidden = false;
  els.flashProgress.style.width = '0%';
  els.flashProgressText.textContent = '0%';

  // If monitor is running, stop it first
  monitorWasRunning = monitor?.running || false;
  if (monitorWasRunning) {
    flashLog('Zastavení monitoru...', 'info');
    await monitor.stop();
    updateMonitorUI(false);
  }

  try {
    updateConnectionStatus('flashing', 'Nahrávání...');

    await flasher.flash(fw, {
      onLog: flashLog,
      onProgress: (pct) => {
        els.flashProgress.style.width = `${pct}%`;
        els.flashProgressText.textContent = `${pct}%`;
      },
      onStatus: (status) => {
        if (status === 'done') {
          updateConnectionStatus('connected', 'Připojeno');
        }
      },
    });

    // Auto-restart monitor after flash
    if (monitorWasRunning) {
      flashLog('Restartování monitoru...', 'info');
      await new Promise(r => setTimeout(r, 500));
      try {
        const baudRate = parseInt(els.baudRate.value);
        await monitor.start(baudRate);
        updateMonitorUI(true);
        // Switch to monitor tab
        els.tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="monitor"]').classList.add('active');
        els.tabFlash.classList.remove('active');
        els.tabMonitor.classList.add('active');
      } catch (e) {
        flashLog(`Monitor se nepodařilo restartovat: ${e.message}`, 'error');
      }
    }
  } catch (e) {
    flashLog(`Chyba: ${e.message}`, 'error');
    updateConnectionStatus('connected', 'Připojeno');
  } finally {
    isFlashing = false;
    updateFlashButton();
  }
});

// ── Monitor tab ───────────────────────────────────────────
function updateMonitorUI(connected) {
  els.connectMonitorBtn.textContent = connected ? 'Odpojit' : 'Připojit';
  els.monitorInput.disabled = !connected;
  els.sendBtn.disabled = !connected;
}

// Create monitor instance
monitor = new Monitor(serial, {
  output: els.monitorOutput,
  input: els.monitorInput,
  lineEnding: els.lineEnding,
});

els.connectMonitorBtn.addEventListener('click', async () => {
  if (monitor.running) {
    await monitor.stop();
    updateMonitorUI(false);
    updateConnectionStatus('disconnected', 'Odpojeno');
    return;
  }

  try {
    // Request port if not already selected
    if (!serial.hasPort) {
      await serial.requestPort();
    }

    const baudRate = parseInt(els.baudRate.value);
    await monitor.start(baudRate);
    updateMonitorUI(true);
    updateConnectionStatus('connected', 'Připojeno');
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      monitor.appendOutput(`Chyba: ${e.message}\n`, 'log-error');
    }
  }
});

els.clearMonitorBtn.addEventListener('click', () => monitor.clear());

els.copyMonitorBtn.addEventListener('click', async () => {
  await monitor.copyAll();
  const original = els.copyMonitorBtn.textContent;
  els.copyMonitorBtn.textContent = 'Zkopírováno!';
  setTimeout(() => { els.copyMonitorBtn.textContent = original; }, 1500);
});

els.monitorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && monitor.running) {
    monitor.send(els.monitorInput.value);
    els.monitorInput.value = '';
  }
});

els.sendBtn.addEventListener('click', () => {
  if (monitor.running) {
    monitor.send(els.monitorInput.value);
    els.monitorInput.value = '';
  }
});

// ── Init ──────────────────────────────────────────────────
loadFirmwares();
