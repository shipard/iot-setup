import { ESPLoader, Transport } from '../lib/esptool-bundle.js';
import { t } from './i18n.js';

/**
 * Flasher - wraps esptool-js for firmware flashing.
 */
export class Flasher {
  constructor(serialManager) {
    this._serial = serialManager;
    this._transport = null;
    this._esploader = null;
  }

  /**
   * Flash firmware to the connected ESP32.
   *
   * @param {object} firmware - Firmware metadata from the API
   * @param {object} callbacks - { onLog, onProgress, onStatus }
   */
  async flash(firmware, { onLog, onProgress, onStatus } = {}) {
    const log = (msg, cls) => onLog?.(msg, cls);
    const port = this._serial.getPort();

    if (!port) throw new Error('No serial port selected');

    try {
      this._serial.mode = 'flash';
      onStatus?.('connecting');

      // Create transport from raw port
      log(t('flash_creating_transport'), 'info');
      this._transport = new Transport(port, true);

      // Create ESPLoader
      const flashOptions = {
        transport: this._transport,
        baudrate: firmware.baudRate || 921600,
        romBaudrate: 115200,
        terminal: {
          clean() {},
          writeLine(data) { log(data); },
          write(data) { log(data); },
        },
      };

      this._esploader = new ESPLoader(flashOptions);

      // Connect and detect chip
      log(t('flash_connecting'), 'info');
      const chipName = await this._esploader.main();
      log(t('flash_chip_detected', { chipName }), 'success');

      // Chip mismatch warning
      if (firmware.chip && chipName && !chipName.toUpperCase().includes(firmware.chip.toUpperCase().replace('ESP32-', 'ESP32'))) {
        const normalizedChip = firmware.chip.toUpperCase();
        const normalizedDetected = chipName.toUpperCase();
        if (!normalizedDetected.includes(normalizedChip.replace('-', ''))) {
          log(t('flash_chip_mismatch', { chip: firmware.chip, detected: chipName }), 'error');
        }
      }

      // Download firmware binary
      log(t('flash_downloading'), 'info');
      onStatus?.('downloading');
      const response = await fetch(`/api/firmware/${firmware.id}`);
      if (!response.ok) throw new Error(`Firmware download failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      log(t('flash_downloaded', { size: (arrayBuffer.byteLength / 1024).toFixed(1) }), 'success');

      // Convert ArrayBuffer to binary string (esptool-js format)
      const bytes = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }

      // Flash
      const flashOffset = parseInt(firmware.flashOffset || '0x0', 16);
      log(t('flash_writing', { offset: flashOffset.toString(16) }), 'info');
      onStatus?.('flashing');

      const fileArray = [{
        data: binaryString,
        address: flashOffset,
      }];

      await this._esploader.writeFlash({
        fileArray,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          const pct = Math.round((written / total) * 100);
          onProgress?.(pct);
        },
      });

      log(t('flash_success'), 'success');
      onProgress?.(100);

      // Hard reset
      log(t('flash_resetting'), 'info');
      await this._transport.setDTR(false);
      await this._transport.setRTS(true);
      await new Promise(r => setTimeout(r, 100));
      await this._transport.setRTS(false);

      onStatus?.('done');
      log(t('flash_rebooted'), 'success');
    } finally {
      // Clean up transport
      if (this._transport) {
        try {
          await this._transport.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
        this._transport = null;
        this._esploader = null;
      }
      this._serial.mode = 'idle';
    }
  }
}
