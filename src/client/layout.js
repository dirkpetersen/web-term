/**
 * Layout Manager - handles split pane layout
 * Layout: [File Browser] | [Terminal 1 (large)] | [Terminal 2 (top) / Terminal 3 (bottom)]
 */
class LayoutManager {
  constructor() {
    this.fileBrowserWidth = 250;
    this.terminalSplitRatio = 60; // Terminal 1 takes 60% of terminal area
    this.rightPanelSplit = 50; // Split between terminal 2 and 3
    this.isResizing = false;
    this.resizeType = null;
  }

  /**
   * Initialize layout with resizable split panes
   * @param {HTMLElement} container - Main container element
   */
  initLayout(container) {
    container.innerHTML = `
      <div class="main-layout">
        <div class="left-panel" id="left-panel" style="width: ${this.fileBrowserWidth}px;">
          <div id="file-browser-container"></div>
        </div>
        <div class="resize-handle resize-handle-vertical" id="resize-fb"></div>
        <div class="terminal-area" id="terminal-area">
          <div class="terminal-pane terminal-main" id="terminal-1"></div>
          <div class="resize-handle resize-handle-vertical" id="resize-term-split"></div>
          <div class="terminal-right-panel" id="terminal-right">
            <div class="terminal-pane" id="terminal-2" style="height: ${this.rightPanelSplit}%;"></div>
            <div class="resize-handle resize-handle-horizontal" id="resize-horizontal"></div>
            <div class="terminal-pane" id="terminal-3" style="height: ${100 - this.rightPanelSplit}%;"></div>
          </div>
        </div>
      </div>
    `;

    this.setupResizeHandlers();
    this.loadLayoutPreferences();
    this.applyTerminalSplit();
  }

  /**
   * Set up resize handle event listeners
   */
  setupResizeHandlers() {
    const fbHandle = document.getElementById('resize-fb');
    const termSplitHandle = document.getElementById('resize-term-split');
    const horizontalHandle = document.getElementById('resize-horizontal');

    fbHandle.addEventListener('mousedown', () => this.startResize('file-browser'));
    termSplitHandle.addEventListener('mousedown', () => this.startResize('terminal-split'));
    horizontalHandle.addEventListener('mousedown', () => this.startResize('horizontal'));

    document.addEventListener('mousemove', (e) => this.handleResize(e));
    document.addEventListener('mouseup', () => this.stopResize());
  }

  /**
   * Start resizing
   * @param {string} type - Resize type
   */
  startResize(type) {
    this.isResizing = true;
    this.resizeType = type;
    document.body.style.cursor = type === 'horizontal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Handle resize mouse move
   * @param {MouseEvent} e - Mouse event
   */
  handleResize(e) {
    if (!this.isResizing) return;

    if (this.resizeType === 'file-browser') {
      this.setFileBrowserWidth(e.clientX);
    } else if (this.resizeType === 'terminal-split') {
      const terminalArea = document.getElementById('terminal-area');
      const rect = terminalArea.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      this.setTerminalSplitRatio(ratio);
    } else if (this.resizeType === 'horizontal') {
      const rightPanel = document.getElementById('terminal-right');
      const rect = rightPanel.getBoundingClientRect();
      const ratio = ((e.clientY - rect.top) / rect.height) * 100;
      this.setRightPanelSplit(ratio);
    }
  }

  /**
   * Stop resizing
   */
  stopResize() {
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeType = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      this.saveLayoutPreferences();

      // Fit terminals after resize
      if (window.terminalManager) {
        setTimeout(() => {
          window.terminalManager.fitAllTerminals();
        }, 50);
      }
    }
  }

  /**
   * Set file browser panel width
   * @param {number} width - Width in pixels
   */
  setFileBrowserWidth(width) {
    width = Math.max(150, Math.min(width, window.innerWidth - 600));
    this.fileBrowserWidth = width;

    const leftPanel = document.getElementById('left-panel');
    leftPanel.style.width = width + 'px';
  }

  /**
   * Set terminal split ratio (terminal 1 vs right panel)
   * @param {number} ratio - Split ratio (0-100)
   */
  setTerminalSplitRatio(ratio) {
    ratio = Math.max(30, Math.min(ratio, 80));
    this.terminalSplitRatio = ratio;
    this.applyTerminalSplit();
  }

  /**
   * Apply terminal split ratio to DOM
   */
  applyTerminalSplit() {
    const terminal1 = document.getElementById('terminal-1');
    const terminalRight = document.getElementById('terminal-right');

    if (terminal1 && terminalRight) {
      terminal1.style.flex = `0 0 ${this.terminalSplitRatio}%`;
      terminalRight.style.flex = `0 0 ${100 - this.terminalSplitRatio - 1}%`;
    }
  }

  /**
   * Set right panel split ratio (terminal 2 vs 3)
   * @param {number} ratio - Split ratio (0-100)
   */
  setRightPanelSplit(ratio) {
    ratio = Math.max(20, Math.min(ratio, 80));
    this.rightPanelSplit = ratio;

    const terminal2 = document.getElementById('terminal-2');
    const terminal3 = document.getElementById('terminal-3');

    terminal2.style.height = ratio + '%';
    terminal3.style.height = (100 - ratio) + '%';
  }

  /**
   * Save layout preferences to localStorage
   */
  saveLayoutPreferences() {
    localStorage.setItem('layout', JSON.stringify({
      fileBrowserWidth: this.fileBrowserWidth,
      terminalSplitRatio: this.terminalSplitRatio,
      rightPanelSplit: this.rightPanelSplit
    }));
  }

  /**
   * Load layout preferences from localStorage
   */
  loadLayoutPreferences() {
    const saved = localStorage.getItem('layout');
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        if (layout.fileBrowserWidth) {
          this.fileBrowserWidth = layout.fileBrowserWidth;
          this.setFileBrowserWidth(layout.fileBrowserWidth);
        }
        if (layout.terminalSplitRatio) {
          this.terminalSplitRatio = layout.terminalSplitRatio;
        }
        if (layout.rightPanelSplit) {
          this.rightPanelSplit = layout.rightPanelSplit;
          this.setRightPanelSplit(layout.rightPanelSplit);
        }
      } catch (err) {
        console.error('Failed to load layout preferences:', err);
      }
    }
  }

  /**
   * Collapse file browser panel
   */
  collapseFileBrowser() {
    this.setFileBrowserWidth(0);
  }

  /**
   * Expand file browser panel
   */
  expandFileBrowser() {
    this.setFileBrowserWidth(250);
  }

  /**
   * Set up keyboard shortcuts for pane resizing
   * Shift+Alt+Left/Right: resize left/right terminal split
   * Shift+Alt+Up/Down: resize top/bottom split on right side
   */
  setupKeyboardShortcuts() {
    const RESIZE_STEP = 5; // Percentage step for each keypress

    // Use capture phase to intercept before terminal gets the event
    document.addEventListener('keydown', (e) => {
      // Check for Shift+Alt modifier combination
      if (!e.shiftKey || !e.altKey) return;

      // Only handle arrow keys
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;

      // Stop event from reaching terminal
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      switch (e.key) {
        case 'ArrowLeft':
          this.setTerminalSplitRatio(this.terminalSplitRatio - RESIZE_STEP);
          this.saveLayoutPreferences();
          this.fitTerminalsAfterResize();
          break;

        case 'ArrowRight':
          this.setTerminalSplitRatio(this.terminalSplitRatio + RESIZE_STEP);
          this.saveLayoutPreferences();
          this.fitTerminalsAfterResize();
          break;

        case 'ArrowUp':
          this.setRightPanelSplit(this.rightPanelSplit - RESIZE_STEP);
          this.saveLayoutPreferences();
          this.fitTerminalsAfterResize();
          break;

        case 'ArrowDown':
          this.setRightPanelSplit(this.rightPanelSplit + RESIZE_STEP);
          this.saveLayoutPreferences();
          this.fitTerminalsAfterResize();
          break;
      }
    }, true); // true = capture phase
  }

  /**
   * Fit terminals after resize with debounce
   */
  fitTerminalsAfterResize() {
    if (window.terminalManager) {
      setTimeout(() => {
        window.terminalManager.fitAllTerminals();
      }, 50);
    }
  }
}

// Export singleton instance
const layoutManager = new LayoutManager();

// Set up keyboard shortcuts when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  layoutManager.setupKeyboardShortcuts();
});
