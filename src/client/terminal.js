// Font size management
let currentFontSize = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

/**
 * Load saved font size
 */
function loadFontSize() {
  const saved = localStorage.getItem('terminalFontSize');
  if (saved) {
    currentFontSize = parseInt(saved, 10);
  }
  return currentFontSize;
}

/**
 * Create a new terminal instance
 * @param {string} containerId - Container element ID
 * @param {string} terminalId - Terminal identifier
 * @returns {Terminal} xterm.js Terminal instance
 */
function createTerminal(containerId, terminalId) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container ${containerId} not found`);
  }

  // Load saved font size
  const savedFontSize = loadFontSize();

  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: savedFontSize,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    },
    allowTransparency: false
  });

  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.open(container);
  fitAddon.fit();

  terminal._terminalId = terminalId;
  terminal._fitAddon = fitAddon;

  return terminal;
}

/**
 * Connect terminal to WebSocket channel
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} terminalId - Terminal identifier
 */
function connectTerminal(terminal, terminalId) {
  wsClient.send('terminal:create', { terminalId });

  wsClient.on('terminal:ready', (payload) => {
    if (payload.terminalId === terminalId) {
      attachTerminalListeners(terminal, terminalId);

      // Clear all terminals to avoid "Last login" messages
      setTimeout(() => {
        terminal.clear(); // Clear xterm.js buffer
        sendTerminalInput(terminalId, 'clear\n');
      }, 600);
    }
  });

  wsClient.on('terminal:data', (payload) => {
    if (payload.terminalId === terminalId) {
      handleTerminalData(terminal, payload.data);
    }
  });

  wsClient.on('terminal:closed', (payload) => {
    if (payload.terminalId === terminalId) {
      terminal.write('\r\n\r\n[Terminal session closed]\r\n');
    }
  });
}

/**
 * Attach terminal event listeners
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} terminalId - Terminal identifier
 */
function attachTerminalListeners(terminal, terminalId) {
  terminal.onData((data) => {
    sendTerminalInput(terminalId, data);
  });

  terminal.onResize(({ cols, rows }) => {
    sendTerminalResize(terminalId, cols, rows);
  });
}

/**
 * Handle terminal data from server
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} data - Output data
 */
function handleTerminalData(terminal, data) {
  terminal.write(data);
}

/**
 * Send terminal input to server
 * @param {string} terminalId - Terminal identifier
 * @param {string} data - Input data
 */
function sendTerminalInput(terminalId, data) {
  wsClient.send('terminal:input', { terminalId, data });
}

/**
 * Send terminal resize to server
 * @param {string} terminalId - Terminal identifier
 * @param {number} cols - Number of columns
 * @param {number} rows - Number of rows
 */
function sendTerminalResize(terminalId, cols, rows) {
  wsClient.send('terminal:resize', { terminalId, cols, rows });
}

/**
 * Fit terminal to container size
 * @param {Terminal} terminal - xterm.js Terminal instance
 */
function fitTerminal(terminal) {
  if (terminal._fitAddon) {
    terminal._fitAddon.fit();
  }
}

/**
 * Destroy terminal instance
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} terminalId - Terminal identifier
 */
function destroyTerminal(terminal, terminalId) {
  wsClient.send('terminal:close', { terminalId });
  terminal.dispose();
}

/**
 * Set font size for all terminals
 * @param {number} size - Font size in pixels
 */
function setTerminalFontSize(size) {
  size = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  currentFontSize = size;

  if (window.terminalManager) {
    window.terminalManager.terminals.forEach((terminal) => {
      terminal.options.fontSize = size;
      fitTerminal(terminal);
    });
  }

  // Save preference
  localStorage.setItem('terminalFontSize', size);
}

/**
 * Increase font size
 */
function increaseFontSize() {
  setTerminalFontSize(currentFontSize + 2);
}

/**
 * Decrease font size
 */
function decreaseFontSize() {
  setTerminalFontSize(currentFontSize - 2);
}

/**
 * Reset font size to default
 */
function resetFontSize() {
  setTerminalFontSize(14);
}

// Set up keyboard shortcuts for font size
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Plus: Increase font size
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    increaseFontSize();
  }
  // Ctrl/Cmd + Minus: Decrease font size
  else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    decreaseFontSize();
  }
  // Ctrl/Cmd + 0: Reset font size
  else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    resetFontSize();
  }
});
