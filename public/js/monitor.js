/**
 * Monitor - serial monitor with auto-scroll, command history, and line endings.
 */
export class Monitor {
  constructor(serialManager, elements) {
    this._serial = serialManager;
    this._output = elements.output;
    this._input = elements.input;
    this._lineEndingSelect = elements.lineEnding;
    this._running = false;
    this._history = [];
    this._historyIndex = -1;
    this._maxLines = 5000;
    this._decoder = new TextDecoder();
    this._autoScroll = true;

    this._setupScrollDetection();
    this._setupKeyboard();
  }

  get running() {
    return this._running;
  }

  /**
   * Start the serial monitor - open port and begin reading.
   */
  async start(baudRate) {
    if (this._running) return;

    const port = this._serial.getPort();
    if (!port) throw new Error('No port selected');

    await this._serial.open(baudRate);
    this._serial.mode = 'monitor';
    this._running = true;

    this._serial.startReading((data) => {
      this.appendOutput(this._decoder.decode(data, { stream: true }));
    });
  }

  /**
   * Stop the serial monitor.
   */
  async stop() {
    if (!this._running) return;
    this._running = false;
    await this._serial.close();
  }

  /**
   * Append text to the console output.
   */
  appendOutput(text, className) {
    const wasAtBottom = this._isAtBottom();

    if (className) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      this._output.appendChild(span);
    } else {
      // Parse for error patterns and colorize
      const lines = text.split(/(\r?\n)/);
      for (const segment of lines) {
        if (/error|fail|panic|abort/i.test(segment)) {
          const span = document.createElement('span');
          span.className = 'log-error';
          span.textContent = segment;
          this._output.appendChild(span);
        } else {
          this._output.appendChild(document.createTextNode(segment));
        }
      }
    }

    this._trimOutput();

    if (wasAtBottom || this._autoScroll) {
      this._scrollToBottom();
    }
  }

  /**
   * Send a command through the serial port.
   */
  async send(text) {
    if (!this._running) return;

    const lineEnding = this._lineEndingSelect.value;
    // The select value has literal \n, \r, etc - convert to actual characters
    const ending = lineEnding
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');

    await this._serial.write(text + ending);

    // Show sent command in output
    this.appendOutput(`> ${text}\n`, 'log-sent');

    // Add to history
    if (text && (this._history.length === 0 || this._history[this._history.length - 1] !== text)) {
      this._history.push(text);
    }
    this._historyIndex = -1;
  }

  /**
   * Clear the console output.
   */
  clear() {
    this._output.textContent = '';
  }

  /**
   * Copy all console text to clipboard.
   */
  async copyAll() {
    const text = this._output.textContent;
    await navigator.clipboard.writeText(text);
  }

  _isAtBottom() {
    const { scrollTop, scrollHeight, clientHeight } = this._output;
    return scrollHeight - scrollTop - clientHeight < 30;
  }

  _scrollToBottom() {
    this._output.scrollTop = this._output.scrollHeight;
  }

  _setupScrollDetection() {
    this._output.addEventListener('scroll', () => {
      this._autoScroll = this._isAtBottom();
    });
  }

  _setupKeyboard() {
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this._history.length === 0) return;
        if (this._historyIndex === -1) {
          this._historyIndex = this._history.length - 1;
        } else if (this._historyIndex > 0) {
          this._historyIndex--;
        }
        this._input.value = this._history[this._historyIndex];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this._historyIndex === -1) return;
        if (this._historyIndex < this._history.length - 1) {
          this._historyIndex++;
          this._input.value = this._history[this._historyIndex];
        } else {
          this._historyIndex = -1;
          this._input.value = '';
        }
      }
    });
  }

  _trimOutput() {
    // Limit the number of child nodes to prevent memory bloat
    while (this._output.childNodes.length > this._maxLines) {
      this._output.removeChild(this._output.firstChild);
    }
  }
}
