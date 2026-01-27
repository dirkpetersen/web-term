/**
 * Terminal Manager - manages multiple terminal instances
 */
class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.lastActiveTerminalId = 'term-1';
  }

  /**
   * Initialize terminals (three panes)
   */
  initTerminals() {
    const terminal1 = createTerminal('terminal-1', 'term-1');
    const terminal2 = createTerminal('terminal-2', 'term-2');
    const terminal3 = createTerminal('terminal-3', 'term-3');

    this.terminals.set('term-1', terminal1);
    this.terminals.set('term-2', terminal2);
    this.terminals.set('term-3', terminal3);

    connectTerminal(terminal1, 'term-1');
    connectTerminal(terminal2, 'term-2');
    connectTerminal(terminal3, 'term-3');

    this.setupTerminalFocus();
    this.setupResizeHandler();
  }

  /**
   * Get terminal instance by ID
   * @param {string} terminalId - Terminal identifier
   * @returns {Terminal} Terminal instance
   */
  getTerminal(terminalId) {
    return this.terminals.get(terminalId);
  }

  /**
   * Focus on specific terminal
   * @param {string} terminalId - Terminal identifier
   */
  focusTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.focus();
      this.lastActiveTerminalId = terminalId;
    }
  }

  /**
   * Send command to the last active terminal
   * @param {string} command - Command to execute
   */
  sendCommandToActiveTerminal(command) {
    const terminalId = this.lastActiveTerminalId;
    sendTerminalInput(terminalId, command + '\n');
    this.focusTerminal(terminalId);
  }

  /**
   * Set up terminal focus on click
   */
  setupTerminalFocus() {
    document.getElementById('terminal-1').addEventListener('click', () => {
      this.focusTerminal('term-1');
    });

    document.getElementById('terminal-2').addEventListener('click', () => {
      this.focusTerminal('term-2');
    });

    document.getElementById('terminal-3').addEventListener('click', () => {
      this.focusTerminal('term-3');
    });

    // Focus first terminal by default
    this.focusTerminal('term-1');
  }

  /**
   * Set up window resize handler
   */
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.fitAllTerminals();
      }, 100);
    });
  }

  /**
   * Fit all terminals to their containers
   */
  fitAllTerminals() {
    this.terminals.forEach((terminal) => {
      fitTerminal(terminal);
    });
  }

  /**
   * Destroy all terminals
   */
  destroyAllTerminals() {
    this.terminals.forEach((terminal, terminalId) => {
      destroyTerminal(terminal, terminalId);
    });
    this.terminals.clear();
  }
}

// Export singleton instance
const terminalManager = new TerminalManager();
