# Development Guide

## Development Environment Setup

### Prerequisites
- Node.js v16+
- npm 7+
- Code editor (VS Code recommended)
- Terminal (bash, zsh, or similar)

### Initial Setup
```bash
git clone <repo-url> web-term
cd web-term
npm install
cp .env.default .env
npm run dev
```

The dev server runs with auto-reload via nodemon.

---

## Project Structure

```
web-term/
├── src/
│   ├── server/
│   │   ├── app.js              # Express app, HTTP routes, WS setup
│   │   ├── auth.js             # SSH authentication
│   │   ├── terminal.js         # PTY channel management
│   │   ├── filebrowser.js      # SFTP file operations
│   │   └── websocket.js        # WebSocket message routing
│   └── client/
│       ├── app.js              # App bootstrap, theme, layout init
│       ├── auth.js             # Login/logout UI
│       ├── websocket.js        # WebSocket client connection
│       ├── terminal.js         # xterm.js wrapper, font size
│       ├── terminalManager.js  # Multi-terminal coordination
│       ├── filebrowser.js      # File browser UI and operations
│       ├── editor.js           # CodeMirror integration
│       ├── layout.js           # Split-pane layout
│       └── ui.js               # Shared utilities (notifications, dialogs)
├── public/
│   ├── index.html              # Single page app shell
│   ├── favicon.png             # Beaver logo
│   ├── css/
│   │   └── styles.css          # Dark/light theme styles
│   └── (xterm.js, CodeMirror from CDN)
├── docs/
│   ├── ARCHITECTURE.md         # System design
│   ├── API.md                  # HTTP and WebSocket endpoints
│   ├── FEATURES.md             # Feature documentation
│   ├── SETUP.md                # Installation and deployment
│   └── DEVELOPMENT.md          # This file
├── package.json
├── .env.default
└── web-term.service
```

---

## Code Organization

### Server-Side

#### app.js
Entry point. Responsibilities:
- Create Express app
- Load environment variables (.env)
- Set up HTTP routes (/api/login, /api/download, /api/upload)
- Serve static files (public/, src/client/)
- Initialize WebSocket server
- Handle graceful shutdown

```javascript
require('dotenv').config();
const express = require('express');
const app = express();
setupRoutes(app);
setupWebSocket(server);
```

#### auth.js
Authentication and session management.

**Key Functions:**
- `authenticateUser(username, password)`: SSH to localhost, validate credentials, create session
- `createSession(username, connection)`: Create session object with UUID
- `getSession(sessionId)`: Retrieve session from Map
- `validateSession(sessionId)`: Check if session exists
- `destroySession(sessionId)`: Close SSH connection, clean up

**Session Structure:**
```javascript
{
  id: 'uuid',
  username: 'john',
  connection: SSHConnection,  // ssh2 Client
  sftp: null,                 // Created on demand
  terminals: new Map()        // { 'term-1': {channel, cols, rows} }
}
```

#### terminal.js
PTY channel management over SSH.

**Key Functions:**
- `createTerminalChannel(session)`: Create new PTY shell channel
- `writeToTerminal(channel, data)`: Send input to terminal
- `resizeTerminal(channel, cols, rows)`: Update terminal size
- `closeTerminalChannel(channel)`: Close PTY channel
- `onTerminalData(channel, callback)`: Register data event handler

**Terminal Structure:**
```javascript
{
  channel: SSHChannel,    // ssh2 ChannelStream
  cols: 120,              // Terminal width in columns
  rows: 30,               // Terminal height in rows
  closed: false
}
```

#### filebrowser.js
SFTP file operations. No class; pure functions.

**Key Functions:**
- `getSftp(session)`: Get or create SFTP client
- `listDirectory(session, path)`: List files
- `readFile(session, path)`: Read file as string
- `readFileBuffer(session, path)`: Read file as Buffer (for download)
- `writeFile(session, path, content)`: Write file
- `uploadFile(session, path, buffer)`: Write uploaded file
- `deleteItem(session, path, isDirectory)`: Delete file/folder
- `createDirectory(session, path)`: Create folder
- `renameItem(session, oldPath, newPath)`: Rename/move
- `getStats(session, path)`: Get file metadata

All use SFTP callbacks (Node.js style: `(err, result) => {}`).

#### websocket.js
WebSocket message routing and session cleanup.

**Key Functions:**
- `handleConnection(ws, sessionId)`: New WS client connects
- `handleMessage(ws, session, message)`: Route incoming messages
- `handleDisconnect(ws, session)`: Clean up on disconnect
- `sendMessage(ws, type, payload)`: Send to client

**Message Processing:**
```javascript
switch (type) {
  case 'terminal:create':
    createNewTerminal(session, payload.terminalId);
    break;
  case 'terminal:input':
    writeToTerminal(session, payload);
    break;
  case 'file:list':
    listDirectory(session, payload.path, payload.requestId);
    break;
  // ... more cases
}
```

### Client-Side

#### app.js
Application bootstrap and theme management.

**Key Class: App**
```javascript
class App {
  initApp()           // Called on page load
  showLoginScreen()   // Render login form
  showMainScreen()    // Render main UI
  initTheme()         // Load saved theme
  toggleTheme()       // Switch light/dark
  applyTheme(theme)   // Update UI colors
}
```

#### auth.js
Login and logout UI.

**Key Functions:**
- `renderLoginForm(container)`: Create login form HTML
- `handleLoginSubmit(username, password)`: POST to /api/login
- `handleLogout()`: POST to /api/logout
- `storeSession(sessionId)`: localStorage
- `getStoredSession()`: localStorage
- `clearSession()`: localStorage

#### websocket.js
WebSocket client connection with reconnection logic.

**Key Class: WebSocketClient**
```javascript
class WebSocketClient {
  connect(sessionId)           // Open WS connection
  disconnect()                 // Close connection
  send(type, payload)          // Send message
  on(type, handler)            // Register listener
  off(type, handler)           // Remove listener
  reconnect()                  // Retry with backoff
}
```

Reconnection strategy:
- Delays: 1s, 2s, 4s, 8s, 16s, 32s (max)
- Resets on successful connection

#### terminal.js
xterm.js wrapper and font size management.

**Key Functions:**
- `createTerminal(containerId, terminalId)`: Create xterm instance
- `connectTerminal(terminal, terminalId)`: Link to WebSocket
- `attachTerminalListeners(terminal, terminalId)`: Bind I/O
- `sendTerminalInput(terminalId, data)`: Send keystrokes
- `sendTerminalResize(terminalId, cols, rows)`: Send size change
- `fitTerminal(terminal)`: Fit to container
- `setTerminalFontSize(size)`: Update font size for all

**Font Size Globals:**
```javascript
let currentFontSize = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
```

#### terminalManager.js
Multi-terminal coordination.

**Key Class: TerminalManager**
```javascript
class TerminalManager {
  initTerminals()                           // Create 3 terminals
  getTerminal(terminalId)                   // Get instance by ID
  focusTerminal(terminalId)                 // Set focus
  sendCommandToActiveTerminal(command)      // Send to last active
  destroyAllTerminals()                     // Cleanup on logout
  lastActiveTerminalId = 'term-1'          // Tracks last focused
}
```

#### filebrowser.js
File browser UI and operations.

**Key Class: FileBrowser**
```javascript
class FileBrowser {
  initFileBrowser(startPath)         // Initialize UI
  loadDirectory(path)                // Fetch and render
  renderFileTree(files)              // Render file list
  renderBreadcrumb(path)             // Render navigation
  downloadSelectedFile()             // Download via toolbar
  deleteItem(path)                   // Delete with confirmation
  renameItem(path)                   // Rename with prompt
  createNewFile(parentPath)          // Create file
  createNewFolder(parentPath)        // Create folder
  convertToMarkdown(path)            // Pandoc integration
  isPandocConvertible(path)          // Check format
}
```

#### editor.js
CodeMirror file editor.

**Key Class: FileEditor**
```javascript
class FileEditor {
  initEditor()                  // Create modal
  openFile(path, content)       // Load into CodeMirror
  saveFile()                    // Save to server
  closeEditor()                 // Close modal
  hasUnsavedChanges()           // Check dirty state
  detectMode(filename)          // Language auto-detect
  cm                            // CodeMirror instance
}
```

**Language Detection:**
Maps file extensions to CodeMirror modes (javascript, python, shell, etc.).

#### layout.js
Resizable split-pane layout.

**Key Functions:**
- `initLayout(container)`: Create split panes
- `setLeftPanelWidth(width)`: Resize file browser
- `setRightPanelSplit(ratio)`: Split terminals vertically
- `saveLayoutPreferences()`: localStorage
- `loadLayoutPreferences()`: localStorage

Uses CSS Grid + draggable dividers.

#### ui.js
Shared UI utilities.

**Key Functions:**
- `showNotification(message, type, duration)`: Toast notification
- `showConfirmDialog(title, message)`: Promise-based confirm
- `showPromptDialog(title, message, default)`: Promise-based input
- `showLoadingOverlay(message)`: Loading spinner
- `hideLoadingOverlay()`: Hide spinner
- `triggerDownload(path)`: Fetch blob + download
- `formatFileSize(bytes)`: "2.5 MB"
- `formatDate(timestamp)`: "Jan 26"
- `getFileIcon(filename, isDir)`: Icon emoji

---

## Adding Features

### Add a File Operation

**Example: Duplicate File**

1. **Add backend function** (filebrowser.js):
```javascript
async function duplicateFile(session, path) {
  const sftp = await getSftp(session);
  const newPath = path.replace(/(\.\w+)?$/, '_copy$1');
  // Read original
  // Write to new path
  return newPath;
}
module.exports.duplicateFile = duplicateFile;
```

2. **Add WebSocket handler** (websocket.js):
```javascript
case 'file:duplicate':
  const newPath = await filebrowser.duplicateFile(session, payload.path);
  sendMessage(ws, 'file:duplicate:response', {
    requestId: payload.requestId,
    newPath
  });
  break;
```

3. **Add client UI** (filebrowser.js):
```javascript
// In renderContextMenu
if (!isDir) {
  menuItems.push({
    label: 'Duplicate',
    action: () => this.duplicateFile(path)
  });
}

duplicateFile(path) {
  wsClient.send('file:duplicate', { path, requestId: this.getNextRequestId() });
}
```

4. **Test**: Right-click file → "Duplicate"

### Add a Terminal Command

**Example: Clear All Terminals**

1. **Add terminalManager method**:
```javascript
clearAllTerminals() {
  this.terminals.forEach((terminal, terminalId) => {
    sendTerminalInput(terminalId, 'clear\n');
  });
}
```

2. **Add UI button** (app.js):
```html
<button id="clear-btn" title="Clear all terminals">🧹</button>
```

3. **Wire up handler**:
```javascript
document.getElementById('clear-btn').addEventListener('click', () => {
  window.terminalManager.clearAllTerminals();
});
```

### Add a New Setting

**Example: Terminal Bell Sound**

1. **Add localStorage**:
```javascript
// In app.js
loadSettings() {
  const bellEnabled = localStorage.getItem('terminalBell') !== 'false';
  return { bellEnabled };
}
```

2. **Add UI toggle**:
```html
<label>
  <input type="checkbox" id="bell-toggle"> Terminal bell
</label>
```

3. **Save on change**:
```javascript
document.getElementById('bell-toggle').addEventListener('change', (e) => {
  localStorage.setItem('terminalBell', e.target.checked);
});
```

---

## Debugging

### Browser DevTools
Press F12 in browser:

**Console Tab:**
- View errors and logs
- Test `getStoredSession()`, `wsClient`, etc.
- Inspect DOM elements

**Network Tab:**
- Monitor /api/login, /api/download requests
- Check WebSocket messages (WS tab)
- View response bodies

**Storage Tab:**
- View localStorage (sessionId, theme, layout)
- Clear cache for fresh start

### Server Logs
Development:
```bash
npm run dev
```

Production:
```bash
journalctl --user -u web-term.service -f
```

### Add Console Logging
Client:
```javascript
console.log('User logged in:', username);
console.error('File error:', error);
```

Server:
```javascript
console.log('Download request:', filePath);
console.error('Auth failed:', err.message);
```

---

## Testing

### Manual Testing Checklist
- [ ] Login with valid/invalid credentials
- [ ] Browse directories (including home restriction)
- [ ] Create file/folder
- [ ] Upload file
- [ ] Download file
- [ ] Edit file (save changes)
- [ ] Delete file
- [ ] Rename file
- [ ] Type in terminal
- [ ] Resize terminal
- [ ] Change font size
- [ ] Toggle light/dark mode
- [ ] Pandoc conversion (if installed)
- [ ] Logout and login again

### Browser Compatibility
- Chrome/Edge: Fully supported
- Firefox: Fully supported
- Safari: Mostly supported (xterm.js compatible)
- IE11: Not supported

---

## Performance Profiling

### Browser DevTools Performance Tab
1. Open DevTools → Performance tab
2. Click "Record"
3. Perform action (e.g., list directory)
4. Click "Stop"
5. Analyze flame chart

### Node.js CPU Profiling
```bash
node --prof src/server/app.js
# ... use app ...
# Ctrl+C to stop
node --prof-process isolate-*.log > profile.txt
```

---

## Common Issues

### WebSocket Connection Fails
**Debug:**
```javascript
// In browser console
wsClient.ws  // undefined means not connected
// Check Network tab → WS filter
```

### SSH2 Connection Hangs
**Issue**: SSH connection not responding

**Debug:**
```javascript
// In server code
console.log('SSH connecting...');
sshClient.on('error', (err) => console.error('SSH error:', err));
sshClient.on('ready', () => console.log('SSH connected'));
```

### File Size Limit Exceeded
**Issue**: "413 Payload Too Large"

**Fix**: In app.js, increase Express limit:
```javascript
app.use(express.raw({ type: '*/*', limit: '500mb' }));
```

### Terminal Output Corrupted
**Issue**: Terminal display garbled after resize

**Debug**: Check if terminal resize is being sent:
```javascript
// In terminal.js
console.log('Sending resize:', cols, rows);
```

---

## Code Style

### JavaScript Style Guide
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Single quotes preferred
- **Var**: Use `const` by default, `let` if needed, avoid `var`
- **Naming**: camelCase for variables/functions, PascalCase for classes

### Example
```javascript
const PORT = 3000;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

class FileManager {
  async readFile(path) {
    const content = await this.getSftp().readFile(path);
    return content;
  }
}
```

---

## Deployment Checklist

Before deploying to production:
- [ ] Set `NODE_ENV=production` in .env
- [ ] Set up HTTPS via reverse proxy (nginx/Caddy)
- [ ] Enable WSS (WebSocket Secure)
- [ ] Test SSH authentication
- [ ] Test file operations
- [ ] Set up systemd service
- [ ] Enable firewall rules
- [ ] Test with multiple concurrent users
- [ ] Check disk space
- [ ] Review security settings
- [ ] Document admin procedures

