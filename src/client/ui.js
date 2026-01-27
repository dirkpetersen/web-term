/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 * @param {number} duration - Duration in milliseconds
 */
function showNotification(message, type = 'info', duration = 3000) {
  const container = getOrCreateNotificationContainer();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('notification-show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('notification-show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

/**
 * Get or create notification container
 * @returns {HTMLElement} Notification container
 */
function getOrCreateNotificationContainer() {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show confirm dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @returns {Promise<boolean>} True if confirmed
 */
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-content dialog-content">
        <div class="dialog-header">
          <h3>${title}</h3>
        </div>
        <div class="dialog-body">
          <p>${message}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" id="dialog-cancel">Cancel</button>
          <button class="btn-primary" id="dialog-confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.style.display = 'flex';

    dialog.querySelector('#dialog-confirm').addEventListener('click', () => {
      dialog.remove();
      resolve(true);
    });

    dialog.querySelector('#dialog-cancel').addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve(false);
      }
    });
  });
}

/**
 * Show prompt dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} Input value or null if cancelled
 */
function showPromptDialog(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-content dialog-content">
        <div class="dialog-header">
          <h3>${title}</h3>
        </div>
        <div class="dialog-body">
          <p>${message}</p>
          <input type="text" id="dialog-input" class="dialog-input" value="${defaultValue}">
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" id="dialog-cancel">Cancel</button>
          <button class="btn-primary" id="dialog-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.style.display = 'flex';

    const input = dialog.querySelector('#dialog-input');
    input.focus();
    input.select();

    const submit = () => {
      const value = input.value.trim();
      dialog.remove();
      resolve(value || null);
    };

    dialog.querySelector('#dialog-ok').addEventListener('click', submit);

    dialog.querySelector('#dialog-cancel').addEventListener('click', () => {
      dialog.remove();
      resolve(null);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submit();
      } else if (e.key === 'Escape') {
        dialog.remove();
        resolve(null);
      }
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve(null);
      }
    });
  });
}

/**
 * Show loading overlay
 * @param {string} message - Loading message
 */
function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message" id="loading-message">${message}</div>
    `;
    document.body.appendChild(overlay);
  }

  overlay.querySelector('#loading-message').textContent = message;
  overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Trigger file download
 * @param {string} path - File path to download
 */
function triggerDownload(path) {
  const sessionId = getStoredSession();
  const filename = path.split('/').pop();
  const url = `/api/download?sessionId=${sessionId}&path=${encodeURIComponent(path)}`;

  console.log('Triggering download:', { path, filename, url });
  showNotification(`Downloading ${filename}...`, 'info', 2000);

  // Use fetch to handle errors properly, then trigger download
  fetch(url)
    .then(response => {
      console.log('Download response:', response.status, response.headers.get('content-type'));
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(text || 'Download failed');
        });
      }
      return response.blob();
    })
    .then(blob => {
      console.log('Blob received:', blob.size, blob.type);
      if (blob.size === 0) {
        throw new Error('Empty file received');
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      console.log('Clicking download link...');
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        console.log('Download cleanup done');
      }, 100);
    })
    .catch(err => {
      console.error('Download error:', err);
      showNotification('Download failed: ' + err.message, 'error');
    });
}

/**
 * Format file size to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date to human readable format
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // If less than 24 hours ago, show relative time
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours === 0) {
      const minutes = Math.floor(diff / (60 * 1000));
      return minutes <= 1 ? 'just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  // Otherwise show date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (year === now.getFullYear()) {
    return `${month}/${day}`;
  }

  return `${month}/${day}/${year}`;
}

/**
 * Get file icon based on filename
 * @param {string} filename - Filename
 * @param {boolean} isDirectory - Whether it's a directory
 * @returns {string} Icon emoji or character
 */
function getFileIcon(filename, isDirectory) {
  if (isDirectory) {
    return '📁';
  }

  const ext = filename.split('.').pop().toLowerCase();

  const iconMap = {
    // Code
    'js': '📜',
    'ts': '📘',
    'py': '🐍',
    'rb': '💎',
    'go': '🔷',
    'rs': '🦀',
    'c': '©️',
    'cpp': 'C++',
    'java': '☕',
    'php': '🐘',

    // Web
    'html': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'json': '{}',
    'xml': '📋',

    // Documents
    'md': '📝',
    'txt': '📄',
    'pdf': '📕',
    'doc': '📘',
    'docx': '📘',

    // Media
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🎨',
    'mp3': '🎵',
    'mp4': '🎬',
    'wav': '🎵',

    // Archives
    'zip': '📦',
    'tar': '📦',
    'gz': '📦',
    '7z': '📦',

    // Config
    'env': '⚙️',
    'conf': '⚙️',
    'config': '⚙️',
    'yml': '⚙️',
    'yaml': '⚙️',
    'toml': '⚙️',

    // Shell
    'sh': '🐚',
    'bash': '🐚',
    'zsh': '🐚'
  };

  return iconMap[ext] || '📄';
}
