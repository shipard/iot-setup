const TRANSLATIONS = {
  en: {
    browser_warning: 'Web Serial API is not supported in your browser. Please use',
    browser_warning_or: 'or',
    label_firmware: 'Firmware',
    loading: 'Loading...',
    btn_connect_flash: 'Connect ESP32',
    btn_flash: 'Flash Firmware',
    label_baud_rate: 'Baud rate',
    label_line_ending: 'Line ending',
    line_ending_none: 'None',
    btn_connect_monitor: 'Connect',
    btn_disconnect_monitor: 'Disconnect',
    btn_clear: 'Clear',
    btn_copy_all: 'Copy All',
    placeholder_command: 'Enter command...',
    btn_send: 'Send',
    status_disconnected: 'Disconnected',
    status_connected: 'Connected',
    status_flashing: 'Flashing...',
    firmware_placeholder: '-- Select firmware --',
    msg_stopping_monitor: 'Stopping monitor...',
    msg_restarting_monitor: 'Restarting monitor...',
    err_monitor_restart: 'Failed to restart monitor: {error}',
    err_generic: 'Error: {message}',
    err_usb_disconnected: 'USB disconnected during flashing!',
    msg_port_selected: 'Port selected',
    err_connection: 'Connection error: {message}',
    msg_copied: 'Copied!',
    err_firmware_load: 'Load error',
    flash_creating_transport: 'Creating transport...',
    flash_connecting: 'Connecting to ESP32...',
    flash_chip_detected: 'Chip detected: {chipName}',
    flash_chip_mismatch: 'Warning: Firmware is for {chip}, but detected {detected}',
    flash_downloading: 'Downloading firmware...',
    flash_downloaded: 'Firmware downloaded ({size} KB)',
    flash_writing: 'Writing to offset 0x{offset}...',
    flash_success: 'Firmware flashed successfully!',
    flash_resetting: 'Resetting ESP32...',
    flash_rebooted: 'ESP32 rebooted.',
  },
  cs: {
    browser_warning: 'Web Serial API není podporováno ve vašem prohlížeči. Použijte prosím',
    browser_warning_or: 'nebo',
    label_firmware: 'Firmware',
    loading: 'Načítání...',
    btn_connect_flash: 'Připojit ESP32',
    btn_flash: 'Nahrát firmware',
    label_baud_rate: 'Baud rate',
    label_line_ending: 'Konec řádku',
    line_ending_none: 'Žádné',
    btn_connect_monitor: 'Připojit',
    btn_disconnect_monitor: 'Odpojit',
    btn_clear: 'Vymazat',
    btn_copy_all: 'Kopírovat vše',
    placeholder_command: 'Zadejte příkaz...',
    btn_send: 'Odeslat',
    status_disconnected: 'Odpojeno',
    status_connected: 'Připojeno',
    status_flashing: 'Nahrávání...',
    firmware_placeholder: '-- Vyberte firmware --',
    msg_stopping_monitor: 'Zastavení monitoru...',
    msg_restarting_monitor: 'Restartování monitoru...',
    err_monitor_restart: 'Monitor se nepodařilo restartovat: {error}',
    err_generic: 'Chyba: {message}',
    err_usb_disconnected: 'USB odpojeno během flashování!',
    msg_port_selected: 'Port vybrán',
    err_connection: 'Chyba připojení: {message}',
    msg_copied: 'Zkopírováno!',
    err_firmware_load: 'Chyba načítání',
    flash_creating_transport: 'Vytváření transportu...',
    flash_connecting: 'Připojování k ESP32...',
    flash_chip_detected: 'Detekován čip: {chipName}',
    flash_chip_mismatch: 'Varování: Firmware je pro {chip}, ale detekován {detected}',
    flash_downloading: 'Stahování firmware...',
    flash_downloaded: 'Firmware stažen ({size} KB)',
    flash_writing: 'Nahrávání na offset 0x{offset}...',
    flash_success: 'Firmware úspěšně nahrán!',
    flash_resetting: 'Reset ESP32...',
    flash_rebooted: 'ESP32 restartováno.',
  },
};

const SUPPORTED = ['cs', 'en'];
const LS_KEY = 'esp32tool_lang';

let _lang = 'en';

function _detect() {
  const stored = localStorage.getItem(LS_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : 'en';
}

export function t(key, vars = {}) {
  const str = TRANSLATIONS[_lang]?.[key] ?? TRANSLATIONS['en'][key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function currentLang() {
  return _lang;
}

export function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  _lang = lang;
  localStorage.setItem(LS_KEY, lang);
  document.documentElement.lang = lang;
  _applyToDOM();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

function _applyToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

// Auto-init on module load
_lang = _detect();
document.documentElement.lang = _lang;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _applyToDOM);
} else {
  _applyToDOM();
}
