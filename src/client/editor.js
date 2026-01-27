/**
 * File Editor component with CodeMirror syntax highlighting
 */
class FileEditor {
  constructor() {
    this.currentFile = null;
    this.originalContent = null;
    this.isReadonly = false;
    this.cm = null; // CodeMirror instance
  }

  /**
   * Initialize editor (call once on app init)
   */
  initEditor() {
    const editorHtml = `
      <div id="editor-modal" class="modal" style="display: none;">
        <div class="modal-content editor-modal-content">
          <div class="editor-header">
            <span id="editor-filename" class="editor-filename"></span>
            <div class="editor-actions">
              <button id="editor-download-btn" class="btn-secondary btn-sm" title="Download file">Download</button>
              <button id="editor-save-btn" class="btn-primary btn-sm">Save</button>
              <button id="editor-close-btn" class="btn-secondary btn-sm">Close</button>
            </div>
          </div>
          <div id="editor-container" class="editor-container"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', editorHtml);

    document.getElementById('editor-download-btn').addEventListener('click', () => {
      this.downloadFile();
    });

    document.getElementById('editor-save-btn').addEventListener('click', () => {
      this.saveFile();
    });

    document.getElementById('editor-close-btn').addEventListener('click', () => {
      this.closeEditor();
    });
  }

  /**
   * Open file in editor
   * @param {string} path - File path
   * @param {string} content - File contents
   * @param {boolean} readonly - Whether file is readonly
   */
  openFile(path, content, readonly = false) {
    this.currentFile = path;
    this.originalContent = content;
    this.isReadonly = readonly;

    const filename = path.split('/').pop();
    document.getElementById('editor-filename').textContent = filename;

    const modal = document.getElementById('editor-modal');
    modal.style.display = 'flex';

    // Destroy previous CodeMirror instance if exists
    if (this.cm) {
      this.cm.toTextArea();
      this.cm = null;
    }

    // Clear container and create textarea
    const container = document.getElementById('editor-container');
    container.innerHTML = '<textarea id="editor-textarea"></textarea>';

    const textarea = document.getElementById('editor-textarea');
    textarea.value = content;

    // Initialize CodeMirror
    const isLightMode = document.body.classList.contains('light-mode');
    this.cm = CodeMirror.fromTextArea(textarea, {
      mode: this.detectMode(filename),
      theme: isLightMode ? 'default' : 'material-darker',
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      lineWrapping: true,
      readOnly: readonly,
      autofocus: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      extraKeys: {
        'Ctrl-S': () => this.saveFile(),
        'Cmd-S': () => this.saveFile()
      }
    });

    // Refresh after modal is visible
    setTimeout(() => {
      this.cm.refresh();
      this.cm.focus();
    }, 10);

    const saveBtn = document.getElementById('editor-save-btn');
    saveBtn.disabled = readonly;
    saveBtn.style.display = readonly ? 'none' : 'inline-block';
  }

  /**
   * Save current file
   */
  async saveFile() {
    if (!this.currentFile || this.isReadonly || !this.cm) {
      return;
    }

    const content = this.cm.getValue();

    if (content === this.originalContent) {
      showNotification('No changes to save', 'info');
      return;
    }

    const requestId = Date.now();

    const promise = new Promise((resolve, reject) => {
      const handler = (payload) => {
        if (payload.requestId === requestId) {
          resolve();
          wsClient.off('file:write:response', handler);
        }
      };
      wsClient.on('file:write:response', handler);

      setTimeout(() => {
        reject(new Error('Save timeout'));
        wsClient.off('file:write:response', handler);
      }, 10000);
    });

    wsClient.send('file:write', {
      path: this.currentFile,
      content,
      requestId
    });

    try {
      await promise;
      this.originalContent = content;
      showNotification('File saved', 'success');
    } catch (err) {
      showNotification('Failed to save: ' + err.message, 'error');
    }
  }

  /**
   * Download current file
   */
  downloadFile() {
    if (!this.currentFile) return;
    triggerDownload(this.currentFile);
  }

  /**
   * Close editor
   */
  async closeEditor() {
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.confirmClose();
      if (!confirmed) {
        return;
      }
    }

    const modal = document.getElementById('editor-modal');
    modal.style.display = 'none';

    this.currentFile = null;
    this.originalContent = null;

    if (this.cm) {
      this.cm.toTextArea();
      this.cm = null;
    }
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean} True if there are unsaved changes
   */
  hasUnsavedChanges() {
    if (!this.currentFile || this.isReadonly || !this.cm) {
      return false;
    }
    return this.cm.getValue() !== this.originalContent;
  }

  /**
   * Confirm close if unsaved changes
   * @returns {Promise<boolean>} True if user confirms
   */
  async confirmClose() {
    return showConfirmDialog(
      'Unsaved Changes',
      'You have unsaved changes. Close anyway?'
    );
  }

  /**
   * Detect CodeMirror mode from filename
   * @param {string} filename - Filename
   * @returns {string|Object} CodeMirror mode
   */
  detectMode(filename) {
    const ext = filename.split('.').pop().toLowerCase();

    const modeMap = {
      // JavaScript/TypeScript
      'js': 'javascript',
      'mjs': 'javascript',
      'jsx': { name: 'javascript', jsx: true },
      'ts': { name: 'javascript', typescript: true },
      'tsx': { name: 'javascript', typescript: true, jsx: true },
      'json': { name: 'javascript', json: true },

      // Python
      'py': 'python',
      'pyw': 'python',

      // Shell
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',

      // Web
      'html': 'htmlmixed',
      'htm': 'htmlmixed',
      'css': 'css',
      'scss': 'text/x-scss',
      'less': 'text/x-less',
      'xml': 'xml',
      'svg': 'xml',

      // Markdown
      'md': 'markdown',
      'markdown': 'markdown',

      // Config
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',

      // Database
      'sql': 'sql',

      // Systems languages
      'go': 'go',
      'rs': 'rust',
      'c': 'text/x-csrc',
      'h': 'text/x-csrc',
      'cpp': 'text/x-c++src',
      'cc': 'text/x-c++src',
      'hpp': 'text/x-c++src',
      'java': 'text/x-java',
      'kt': 'text/x-kotlin',
      'cs': 'text/x-csharp',

      // Scripting
      'rb': 'ruby',
      'php': 'php',
      'pl': 'perl',
      'lua': 'lua',

      // Docker
      'dockerfile': 'dockerfile',

      // Default
      'txt': 'text/plain',
      'log': 'text/plain',
      'env': 'shell',
      'gitignore': 'shell',
      'conf': 'shell',
      'cfg': 'shell'
    };

    // Handle special filenames
    const basename = filename.toLowerCase();
    if (basename === 'dockerfile') return 'dockerfile';
    if (basename === 'makefile') return 'shell';
    if (basename.startsWith('.env')) return 'shell';
    if (basename === '.gitignore') return 'shell';

    return modeMap[ext] || 'text/plain';
  }
}

// Export singleton instance
const editor = new FileEditor();
window.editor = editor; // Make globally accessible
