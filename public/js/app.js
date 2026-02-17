import { SerialManager } from './serial.js';
import { Flasher } from './flasher.js';
import { Monitor } from './monitor.js';
import { t, setLanguage, currentLang } from './i18n.js';

// ── Elements ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

const els = {
  browserWarning: $('#browser-warning'),
  connectionStatus: $('#connection-status'),
  connectionText: $('#connection-text'),
  langSelect: $('#lang-select'),
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
let isFirmwareLoading = false;
let _connectionState = 'disconnected';

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
function updateConnectionStatus(state) {
  _connectionState = state;
  els.connectionStatus.className = `connection-status ${state}`;
  els.connectionText.textContent = {
    disconnected: t('status_disconnected'),
    connected: t('status_connected'),
    flashing: t('status_flashing'),
  }[state] || state;
}

serial.onConnect = () => updateConnectionStatus('connected');
serial.onDisconnect = () => {
  updateConnectionStatus('disconnected');
  updateMonitorUI(false);
  if (isFlashing) {
    flashLog(t('err_usb_disconnected'), 'error');
  }
};

// ── Firmware list ─────────────────────────────────────────
async function loadFirmwares() {
  isFirmwareLoading = true;
  try {
    const res = await fetch('/api/firmwares');
    const data = await res.json();
    firmwares = data.firmwares;

    els.firmwareSelect.innerHTML = `<option value="">${t('firmware_placeholder')}</option>`;
    firmwares.forEach(fw => {
      const opt = document.createElement('option');
      opt.value = fw.id;
      opt.textContent = `${fw.name} (${fw.chip})`;
      els.firmwareSelect.appendChild(opt);
    });
    els.firmwareSelect.disabled = false;
  } catch (e) {
    els.firmwareSelect.innerHTML = `<option value="">${t('err_firmware_load')}</option>`;
    console.error('Failed to load firmwares:', e);
  } finally {
    isFirmwareLoading = false;
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
    updateConnectionStatus('connected');
    els.connectFlashBtn.textContent = t('msg_port_selected');
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      flashLog(t('err_connection', { message: e.message }), 'error');
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
    flashLog(t('msg_stopping_monitor'), 'info');
    await monitor.stop();
    updateMonitorUI(false);
  }

  try {
    updateConnectionStatus('flashing');

    await flasher.flash(fw, {
      onLog: flashLog,
      onProgress: (pct) => {
        els.flashProgress.style.width = `${pct}%`;
        els.flashProgressText.textContent = `${pct}%`;
      },
      onStatus: (status) => {
        if (status === 'done') {
          updateConnectionStatus('connected');
        }
      },
    });

    // Auto-restart monitor after flash
    if (monitorWasRunning) {
      flashLog(t('msg_restarting_monitor'), 'info');
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
        flashLog(t('err_monitor_restart', { error: e.message }), 'error');
      }
    }
  } catch (e) {
    flashLog(t('err_generic', { message: e.message }), 'error');
    updateConnectionStatus('connected');
  } finally {
    isFlashing = false;
    updateFlashButton();
  }
});

// ── Monitor tab ───────────────────────────────────────────
function updateMonitorUI(connected) {
  els.connectMonitorBtn.textContent = connected ? t('btn_disconnect_monitor') : t('btn_connect_monitor');
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
    updateConnectionStatus('disconnected');
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
    updateConnectionStatus('connected');
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      monitor.appendOutput(t('err_generic', { message: e.message }) + '\n', 'log-error');
    }
  }
});

els.clearMonitorBtn.addEventListener('click', () => monitor.clear());

els.copyMonitorBtn.addEventListener('click', async () => {
  await monitor.copyAll();
  els.copyMonitorBtn.textContent = t('msg_copied');
  setTimeout(() => { els.copyMonitorBtn.textContent = t('btn_copy_all'); }, 1500);
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

// ── Language selector ─────────────────────────────────────
els.langSelect.value = currentLang();

els.langSelect.addEventListener('change', () => {
  setLanguage(els.langSelect.value);
});

window.addEventListener('languagechange', () => {
  els.langSelect.value = currentLang();

  // Re-apply state-dependent button texts
  updateConnectionStatus(_connectionState);
  updateMonitorUI(monitor?.running || false);

  // Re-apply connect flash button if port is selected and not flashing
  if (serial.hasPort && !isFlashing) {
    els.connectFlashBtn.textContent = t('msg_port_selected');
  }

  // Rebuild firmware select placeholder if still loading or no selection
  if (isFirmwareLoading) {
    // loadFirmwares() is in progress — the initial option has data-i18n="loading"
    // and _applyToDOM already updated it, nothing more to do
  } else if (firmwares.length === 0) {
    // Load error state — update the single option text
    els.firmwareSelect.innerHTML = `<option value="">${t('err_firmware_load')}</option>`;
  } else if (!els.firmwareSelect.value) {
    // Firmwares loaded but nothing selected — update placeholder option
    els.firmwareSelect.options[0].textContent = t('firmware_placeholder');
  }
});

// ── Init ──────────────────────────────────────────────────
loadFirmwares();
