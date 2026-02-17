/**
 * SerialManager - Web Serial API abstraction.
 * Single shared port between flash and monitor modes.
 */
export class SerialManager {
  constructor() {
    this._port = null;
    this._reader = null;
    this._reading = false;
    this._mode = 'idle'; // 'idle' | 'monitor' | 'flash'
    this.onConnect = null;
    this.onDisconnect = null;

    navigator.serial?.addEventListener('disconnect', (e) => {
      if (e.target === this._port) {
        this._cleanup();
        this.onDisconnect?.();
      }
    });
  }

  get mode() {
    return this._mode;
  }

  set mode(value) {
    this._mode = value;
  }

  get hasPort() {
    return this._port !== null;
  }

  /**
   * Request a serial port from the user (triggers browser dialog).
   */
  async requestPort() {
    this._port = await navigator.serial.requestPort();
    this.onConnect?.();
    return this._port;
  }

  /**
   * Get the raw SerialPort (for esptool-js Transport).
   */
  getPort() {
    return this._port;
  }

  /**
   * Open the port at the given baud rate.
   */
  async open(baudRate) {
    if (!this._port) throw new Error('No port selected');
    await this._port.open({ baudRate });
  }

  /**
   * Close the port gracefully.
   */
  async close() {
    await this.stopReading();
    if (this._port?.readable || this._port?.writable) {
      try {
        await this._port.close();
      } catch (e) {
        // Port may already be closed
      }
    }
    this._mode = 'idle';
  }

  /**
   * Start reading data from the port. Calls onData(Uint8Array) for each chunk.
   */
  async startReading(onData) {
    if (!this._port?.readable) throw new Error('Port not open');
    this._reading = true;

    while (this._port.readable && this._reading) {
      this._reader = this._port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this._reader.read();
          if (done || !this._reading) break;
          if (value) onData(value);
        }
      } catch (e) {
        if (this._reading) {
          console.error('Read error:', e);
        }
      } finally {
        this._reader.releaseLock();
        this._reader = null;
      }
    }
  }

  /**
   * Stop the reading loop.
   */
  async stopReading() {
    this._reading = false;
    if (this._reader) {
      try {
        await this._reader.cancel();
      } catch (e) {
        // Reader may already be released
      }
    }
  }

  /**
   * Write data (string or Uint8Array) to the port.
   */
  async write(data) {
    if (!this._port?.writable) throw new Error('Port not writable');
    const writer = this._port.writable.getWriter();
    try {
      const payload = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;
      await writer.write(payload);
    } finally {
      writer.releaseLock();
    }
  }

  _cleanup() {
    this._reading = false;
    this._reader = null;
    this._port = null;
    this._mode = 'idle';
  }
}
