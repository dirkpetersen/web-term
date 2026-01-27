# CLAUDE.md

Web-term is a web-based Linux terminal with file browser, SSH authentication to localhost, and a polished UI.

## Technology Stack

- **Backend:** Node.js + Express + WebSockets (ws)
- **Frontend:** xterm.js + CodeMirror 5 + split-pane layout
- **Auth:** ssh2 library (SSH to localhost)
- **File ops:** SFTP over SSH connection

## Architecture

### Authentication
- Authenticates by SSH to localhost:22 with user credentials
- No root required; runs as regular user under `systemd --user`
- Each user session = persistent SSH connection

### UI Layout
- **Left panel:** File browser with toolbar + breadcrumb + file list
- **Right panel:** 3 terminal panes (1 large left, 2 stacked right)
- **Header:** App title with beaver logo + theme toggle
- Dark mode default; light mode available

## Key Features

- **File browser:** Browse, create, upload, download, delete, rename files
- **Editor:** CodeMirror with syntax highlighting (20+ languages)
- **Pandoc integration:** Right-click convertible files → "Convert to Markdown"
- **Download:** Toolbar button + context menu for selected files
- **Terminals:** 3 concurrent SSH shells; font size controls (Ctrl+±/0)
- **Navigation:** Restricted above home directory; "/" prompt allows anywhere
- **Theme toggle:** Sun/moon icon in header; persisted to localStorage
- **Terminal cleanup:** Auto-clear "Last login" messages on connect

## Recent Changes

### 1. Download Feature
- Added `readFileBuffer()` to read files as buffers (better than streaming)
- Download button (⬇) in toolbar for selected files
- Context menu option for all files
- Improved error handling with user feedback

### 2. Theme System
- Light/dark mode toggle button in header
- CSS variables for both themes
- CodeMirror: 'default' theme (light), 'material-darker' (dark)
- Terminal colors updated on theme switch
- Theme preference saved to localStorage

### 3. Terminal Enhancements
- `TerminalManager.lastActiveTerminalId` tracks focused terminal
- `sendCommandToActiveTerminal()` sends commands to last active terminal
- All terminals auto-clear on connection (600ms delay)

### 4. File Operations
- Pandoc conversion: Right-click on .doc/.docx/.odt/.ppt/.pptx/.epub/.html/.rst/.tex
- Auto-refresh file browser 2 seconds after conversion
- Delete only in context menu for files (not directories)
- Download restricted in file browser toolbar

### 5. Navigation
- `loadDirectory(path, allowOutsideHome)` parameter for security
- Breadcrumb clicks restricted to home directory tree
- "/" root prompt allows navigation anywhere with confirmation

### 6. UI Polish
- Beaver logo (OSU trademark) as favicon + in header
- Improved visual hierarchy and spacing
- Loading overlay respects theme
- File browser toolbar: refresh, new file, new folder, upload, download

## Directory Structure

```
web-term/
├── package.json
├── public/
│   ├── index.html
│   ├── favicon.png          # Beaver logo
│   └── css/styles.css
├── src/
│   ├── server/
│   │   ├── app.js           # Express + routes
│   │   ├── auth.js          # SSH auth
│   │   ├── terminal.js      # Terminal mgmt
│   │   ├── filebrowser.js   # SFTP ops + readFileBuffer()
│   │   └── websocket.js     # WS handler
│   └── client/
│       ├── app.js           # initTheme(), toggleTheme(), applyTheme()
│       ├── terminal.js      # Font size, auto-clear
│       ├── terminalManager.js # lastActiveTerminalId, sendCommandToActiveTerminal()
│       ├── filebrowser.js   # Pandoc convert, download, restricted nav
│       ├── editor.js        # CodeMirror integration
│       └── ui.js            # triggerDownload() with fetch + blob
└── web-term.service
```

## API Endpoints

- `POST /api/login` - SSH authentication
- `POST /api/logout` - Session cleanup
- `GET /api/download?sessionId=X&path=Y` - File download (uses readFileBuffer)
- `POST /api/upload?sessionId=X&path=Y` - File upload
- `WS /?sessionId=X` - WebSocket connection

## Setup

```bash
npm install
npm start              # Run on http://localhost:3000
npm run dev          # Auto-reload with nodemon
```

**Requirements:** SSH server with password auth enabled on localhost.

## WebSocket Messages

**Terminal:** `terminal:create`, `terminal:input`, `terminal:resize`, `terminal:close`
**Files:** `file:list`, `file:read`, `file:write`, `file:delete`, `file:rename`, `file:mkdir`

## Notes

- Binary files open for download, not edit
- Dotfiles hidden by default
- Files sorted by modification time (newest first)
- Terminal prompt automatically cleared on new connections
- Last active terminal receives pandoc commands
- Home directory is security boundary (via loadDirectory parameter)
