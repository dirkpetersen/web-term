/**
 * File Browser component
 */
class FileBrowser {
  constructor(containerId) {
    this.containerId = containerId;
    this.currentPath = null;
    this.homeDirectory = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.setupMessageHandlers();
  }

  /**
   * Initialize file browser
   */
  initFileBrowser(startPath = null) {
    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`Container ${this.containerId} not found`);
    }

    container.innerHTML = `
      <div class="file-browser">
        <div class="file-browser-header">
          <div class="file-browser-toolbar">
            <button id="fb-refresh" class="btn-icon" title="Refresh">
              <span>↻</span>
            </button>
            <button id="fb-new-file" class="btn-icon" title="New File">
              <span>📄</span>
            </button>
            <button id="fb-new-folder" class="btn-icon" title="New Folder">
              <span>📁</span>
            </button>
            <button id="fb-upload" class="btn-icon" title="Upload">
              <span>⬆</span>
            </button>
            <button id="fb-download" class="btn-icon" title="Download selected file">
              <span>⬇</span>
            </button>
          </div>
          <div id="fb-breadcrumb" class="breadcrumb"></div>
        </div>
        <div id="fb-content" class="file-browser-content"></div>
      </div>
    `;

    this.setupToolbarHandlers();

    // Set home directory and don't allow navigation above it
    this.homeDirectory = startPath || '/home/' + getStoredUsername();
    this.loadDirectory(this.homeDirectory);
  }

  /**
   * Setup WebSocket message handlers
   */
  setupMessageHandlers() {
    wsClient.on('file:list:response', (payload) => {
      this.handleListResponse(payload);
    });

    wsClient.on('file:read:response', (payload) => {
      this.handleReadResponse(payload);
    });

    wsClient.on('file:write:response', (payload) => {
      this.handleWriteResponse(payload);
    });

    wsClient.on('file:delete:response', (payload) => {
      this.handleDeleteResponse(payload);
    });

    wsClient.on('file:rename:response', (payload) => {
      this.handleRenameResponse(payload);
    });

    wsClient.on('file:mkdir:response', (payload) => {
      this.handleMkdirResponse(payload);
    });
  }

  /**
   * Setup toolbar button handlers
   */
  setupToolbarHandlers() {
    document.getElementById('fb-refresh').addEventListener('click', () => {
      this.refreshCurrentDirectory();
    });

    document.getElementById('fb-new-file').addEventListener('click', () => {
      this.createNewFile(this.currentPath);
    });

    document.getElementById('fb-new-folder').addEventListener('click', () => {
      this.createNewFolder(this.currentPath);
    });

    document.getElementById('fb-upload').addEventListener('click', () => {
      this.showUploadDialog();
    });

    document.getElementById('fb-download').addEventListener('click', () => {
      this.downloadSelectedFile();
    });
  }

  /**
   * Download currently selected file
   */
  downloadSelectedFile() {
    const selected = document.querySelector('.file-item.selected');
    if (!selected) {
      showNotification('Please select a file to download', 'info');
      return;
    }

    const isDir = selected.dataset.isDir === 'true';
    if (isDir) {
      showNotification('Cannot download directories', 'info');
      return;
    }

    const path = selected.dataset.path;
    this.downloadFile(path);
  }

  /**
   * Load directory contents
   * @param {string} path - Directory path
   * @param {boolean} allowOutsideHome - If true, allow navigation outside home directory
   */
  loadDirectory(path, allowOutsideHome = false) {
    // Restrict navigation above home directory unless explicitly allowed
    if (!allowOutsideHome && this.homeDirectory) {
      const normalizedPath = path.replace(/\/+$/, ''); // Remove trailing slashes
      const normalizedHome = this.homeDirectory.replace(/\/+$/, '');

      // If path doesn't start with home directory, redirect to home
      if (!normalizedPath.startsWith(normalizedHome)) {
        path = this.homeDirectory;
      }
    }

    const requestId = this.getNextRequestId();
    this.currentPath = path;

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'list' });
    });

    wsClient.send('file:list', { path, requestId });

    promise.then((files) => {
      this.renderFileTree(files);
      this.renderBreadcrumb(path);
    }).catch((err) => {
      showNotification('Failed to load directory: ' + err.message, 'error');
    });
  }

  /**
   * Render file tree
   * @param {Array} files - Array of file objects
   */
  renderFileTree(files) {
    const container = document.getElementById('fb-content');

    // Filter out dotfiles (files starting with .)
    files = files.filter(file => !file.name.startsWith('.'));

    // Sort: directories first, then by change time (newest first)
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return b.mtime - a.mtime; // Newest first
    });

    const html = files.map(file => {
      const icon = getFileIcon(file.name, file.isDirectory);
      const date = formatDate(file.mtime);

      return `
        <div class="file-item" data-path="${this.currentPath}/${file.name}" data-is-dir="${file.isDirectory}">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${file.name}</span>
          <span class="file-date">${date}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    this.attachFileItemHandlers();
  }

  /**
   * Render breadcrumb navigation
   * @param {string} path - Current path
   */
  renderBreadcrumb(path) {
    const container = document.getElementById('fb-breadcrumb');
    const parts = path.split('/').filter(p => p);

    // Start with root - dimmed, clicking prompts for path
    let html = '<span class="breadcrumb-item breadcrumb-root" data-path="/" title="Click to go to any path">/</span>';
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath += '/' + part;

      // Check if this path is above home directory
      const isAboveHome = !currentPath.startsWith(this.homeDirectory) && currentPath !== this.homeDirectory;

      html += `<span class="breadcrumb-separator">›</span>`;

      // Dim paths above home directory but still allow clicking
      if (isAboveHome) {
        html += `<span class="breadcrumb-item breadcrumb-disabled" data-path="${currentPath}">${part}</span>`;
      } else {
        html += `<span class="breadcrumb-item" data-path="${currentPath}">${part}</span>`;
      }
    });

    container.innerHTML = html;

    // Handle root click - prompt for path (allows navigation anywhere)
    container.querySelector('.breadcrumb-root').addEventListener('click', async () => {
      const newPath = await showPromptDialog('Go to Path', 'Enter full path:', this.currentPath);
      if (newPath && newPath.startsWith('/')) {
        this.loadDirectory(newPath, true); // Allow navigation outside home
      } else if (newPath) {
        showNotification('Please enter a full path starting with /', 'error');
      }
    });

    // Handle other breadcrumb clicks
    container.querySelectorAll('.breadcrumb-item:not(.breadcrumb-root)').forEach(item => {
      item.addEventListener('click', () => {
        this.loadDirectory(item.dataset.path);
      });
    });
  }

  /**
   * Attach handlers to file items
   */
  attachFileItemHandlers() {
    const items = document.querySelectorAll('.file-item');

    items.forEach(item => {
      item.addEventListener('click', (e) => {
        this.handleItemClick(item);
      });

      item.addEventListener('dblclick', (e) => {
        this.handleItemDoubleClick(item);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.handleContextMenu(item, e);
      });
    });
  }

  /**
   * Handle file item click
   * @param {HTMLElement} item - File item element
   */
  handleItemClick(item) {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
  }

  /**
   * Handle file item double click
   * @param {HTMLElement} item - File item element
   */
  handleItemDoubleClick(item) {
    const path = item.dataset.path;
    const isDir = item.dataset.isDir === 'true';

    if (isDir) {
      this.loadDirectory(path);
    } else if (this.isBinaryFile(path)) {
      // Binary files: download instead of edit
      this.downloadFile(path);
    } else {
      this.openFileInEditor(path);
    }
  }

  /**
   * Check if file is binary based on extension
   * @param {string} path - File path
   * @returns {boolean} True if binary file
   */
  isBinaryFile(path) {
    const binaryExtensions = [
      // Images
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg', 'tiff', 'psd',
      // Audio
      'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
      // Video
      'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v',
      // Archives
      'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'iso', 'dmg',
      // Documents
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
      // Executables
      'exe', 'dll', 'so', 'dylib', 'bin', 'app', 'deb', 'rpm',
      // Fonts
      'ttf', 'otf', 'woff', 'woff2', 'eot',
      // Other binary
      'class', 'pyc', 'o', 'a', 'lib', 'obj', 'db', 'sqlite', 'sqlite3'
    ];

    const ext = path.split('.').pop().toLowerCase();
    return binaryExtensions.includes(ext);
  }

  /**
   * Check if file can be converted to markdown using pandoc
   * @param {string} path - File path
   * @returns {boolean} True if convertible
   */
  isPandocConvertible(path) {
    const convertibleExtensions = [
      // Documents
      'doc', 'docx', 'odt', 'rtf',
      // Presentations
      'ppt', 'pptx', 'odp',
      // E-books
      'epub',
      // Web/markup
      'html', 'htm',
      // Other formats pandoc supports
      'rst', 'textile', 'mediawiki', 'org', 'latex', 'tex'
    ];

    const ext = path.split('.').pop().toLowerCase();
    return convertibleExtensions.includes(ext);
  }

  /**
   * Convert file to markdown using pandoc
   * @param {string} path - File path
   */
  convertToMarkdown(path) {
    const outputPath = path.replace(/\.[^.]+$/, '.md');
    const command = `pandoc "${path}" -o "${outputPath}"`;

    if (window.terminalManager) {
      window.terminalManager.sendCommandToActiveTerminal(command);
      showNotification('Pandoc command sent to terminal', 'info');

      // Refresh file browser after a delay to show the new file
      setTimeout(() => {
        this.refreshCurrentDirectory();
      }, 2000);
    }
  }

  /**
   * Handle context menu
   * @param {HTMLElement} item - File item element
   * @param {Event} event - Mouse event
   */
  handleContextMenu(item, event) {
    const path = item.dataset.path;
    const isDir = item.dataset.isDir === 'true';

    this.renderContextMenu(item, event.pageX, event.pageY);
  }

  /**
   * Render context menu
   * @param {HTMLElement} item - File item element
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  renderContextMenu(item, x, y) {
    this.hideContextMenu();

    const path = item.dataset.path;
    const isDir = item.dataset.isDir === 'true';

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'file-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const menuItems = [
      { label: 'Rename', action: () => this.renameItem(path) }
    ];

    if (!isDir) {
      menuItems.unshift({ label: 'Download', action: () => this.downloadFile(path) });
      menuItems.push({ label: 'Delete', action: () => this.deleteItem(path, isDir) });

      // Add "Convert to Markdown" option for pandoc-convertible files
      if (this.isPandocConvertible(path)) {
        menuItems.push({ label: 'Convert to Markdown', action: () => this.convertToMarkdown(path) });
      }
    }

    menu.innerHTML = menuItems.map(item =>
      `<div class="context-menu-item">${item.label}</div>`
    ).join('');

    document.body.appendChild(menu);

    menu.querySelectorAll('.context-menu-item').forEach((el, index) => {
      el.addEventListener('click', () => {
        menuItems[index].action();
        this.hideContextMenu();
      });
    });

    setTimeout(() => {
      document.addEventListener('click', () => this.hideContextMenu(), { once: true });
    }, 0);
  }

  /**
   * Hide context menu
   */
  hideContextMenu() {
    const menu = document.getElementById('file-context-menu');
    if (menu) {
      menu.remove();
    }
  }

  /**
   * Open file in editor
   * @param {string} path - File path
   */
  openFileInEditor(path) {
    const requestId = this.getNextRequestId();

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'read', path });
    });

    wsClient.send('file:read', { path, requestId });

    promise.then((content) => {
      window.editor.openFile(path, content, false);
    }).catch((err) => {
      showNotification('Failed to read file: ' + err.message, 'error');
    });
  }

  /**
   * Show upload dialog
   */
  showUploadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.uploadFiles(files, this.currentPath);
    });

    input.click();
  }

  /**
   * Upload files
   * @param {Array} files - File list
   * @param {string} destinationPath - Destination directory
   */
  async uploadFiles(files, destinationPath) {
    const sessionId = getStoredSession();

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const destPath = `${destinationPath}/${file.name}`;

        const response = await fetch(`/api/upload?sessionId=${sessionId}&path=${encodeURIComponent(destPath)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: buffer
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }
      } catch (err) {
        showNotification(`Failed to upload ${file.name}: ${err.message}`, 'error');
      }
    }

    showNotification(`Uploaded ${files.length} file(s)`, 'success');
    this.refreshCurrentDirectory();
  }

  /**
   * Download file
   * @param {string} path - File path
   */
  downloadFile(path) {
    triggerDownload(path);
  }

  /**
   * Delete item
   * @param {string} path - Item path
   * @param {boolean} isDirectory - Whether item is a directory
   */
  async deleteItem(path) {
    const confirmed = await showConfirmDialog(
      'Delete',
      `Are you sure you want to delete ${path}?`
    );

    if (!confirmed) return;

    const requestId = this.getNextRequestId();
    const isDirectory = false; // TODO: pass actual value

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'delete' });
    });

    wsClient.send('file:delete', { path, isDirectory, requestId });

    promise.then(() => {
      showNotification('Deleted successfully', 'success');
      this.refreshCurrentDirectory();
    }).catch((err) => {
      showNotification('Failed to delete: ' + err.message, 'error');
    });
  }

  /**
   * Rename item
   * @param {string} path - Current path
   */
  async renameItem(path) {
    const filename = path.split('/').pop();
    const newName = await showPromptDialog('Rename', 'Enter new name:', filename);

    if (!newName || newName === filename) return;

    const newPath = path.substring(0, path.lastIndexOf('/')) + '/' + newName;
    const requestId = this.getNextRequestId();

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'rename' });
    });

    wsClient.send('file:rename', { oldPath: path, newPath, requestId });

    promise.then(() => {
      showNotification('Renamed successfully', 'success');
      this.refreshCurrentDirectory();
    }).catch((err) => {
      showNotification('Failed to rename: ' + err.message, 'error');
    });
  }

  /**
   * Create new file
   * @param {string} parentPath - Parent directory path
   */
  async createNewFile(parentPath) {
    const filename = await showPromptDialog('New File', 'Enter file name:');

    if (!filename) return;

    const path = `${parentPath}/${filename}`;
    const requestId = this.getNextRequestId();

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'write' });
    });

    wsClient.send('file:write', { path, content: '', requestId });

    promise.then(() => {
      showNotification('File created', 'success');
      this.refreshCurrentDirectory();
    }).catch((err) => {
      showNotification('Failed to create file: ' + err.message, 'error');
    });
  }

  /**
   * Create new folder
   * @param {string} parentPath - Parent directory path
   */
  async createNewFolder(parentPath) {
    const foldername = await showPromptDialog('New Folder', 'Enter folder name:');

    if (!foldername) return;

    const path = `${parentPath}/${foldername}`;
    const requestId = this.getNextRequestId();

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, type: 'mkdir' });
    });

    wsClient.send('file:mkdir', { path, requestId });

    promise.then(() => {
      showNotification('Folder created', 'success');
      this.refreshCurrentDirectory();
    }).catch((err) => {
      showNotification('Failed to create folder: ' + err.message, 'error');
    });
  }

  /**
   * Refresh current directory
   */
  refreshCurrentDirectory() {
    if (this.currentPath) {
      this.loadDirectory(this.currentPath);
    }
  }

  /**
   * Get current path
   * @returns {string} Current directory path
   */
  getCurrentPath() {
    return this.currentPath;
  }

  /**
   * Get next request ID
   * @returns {number} Request ID
   */
  getNextRequestId() {
    return ++this.requestId;
  }

  /**
   * Handle list response
   */
  handleListResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'list') {
      request.resolve(payload.files);
      this.pendingRequests.delete(payload.requestId);
    }
  }

  /**
   * Handle read response
   */
  handleReadResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'read') {
      request.resolve(payload.content);
      this.pendingRequests.delete(payload.requestId);
    }
  }

  /**
   * Handle write response
   */
  handleWriteResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'write') {
      request.resolve();
      this.pendingRequests.delete(payload.requestId);
    }
  }

  /**
   * Handle delete response
   */
  handleDeleteResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'delete') {
      request.resolve();
      this.pendingRequests.delete(payload.requestId);
    }
  }

  /**
   * Handle rename response
   */
  handleRenameResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'rename') {
      request.resolve();
      this.pendingRequests.delete(payload.requestId);
    }
  }

  /**
   * Handle mkdir response
   */
  handleMkdirResponse(payload) {
    const request = this.pendingRequests.get(payload.requestId);
    if (request && request.type === 'mkdir') {
      request.resolve();
      this.pendingRequests.delete(payload.requestId);
    }
  }
}

// Export singleton instance
const fileBrowser = new FileBrowser('file-browser-container');
