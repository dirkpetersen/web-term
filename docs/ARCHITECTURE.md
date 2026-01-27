# Architecture Overview

## System Design

Web-term is a three-tier web application with SSH-based authentication and real-time bidirectional communication via WebSockets.

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UI Layer (HTML/CSS)                                  │   │
│  │ - Login form                                         │   │
│  │ - Split-pane layout (file browser + terminals)      │   │
│  │ - File editor modal with CodeMirror                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲ ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Application Layer (JavaScript)                       │   │
│  │ - app.js (bootstrap, theme management)              │   │
│  │ - auth.js (login/logout UI)                         │   │
│  │ - terminalManager.js (3 terminals)                  │   │
│  │ - filebrowser.js (file operations)                  │   │
│  │ - editor.js (syntax highlighting)                  │   │
│  │ - ui.js (notifications, dialogs)                    │   │
│  │ - layout.js (resizable panes)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲ ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Communication Layer (WebSocket + REST)              │   │
│  │ - websocket.js (bidirectional messaging)            │   │
│  │ - Fetch API (login, download, upload)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           WebSocket (ws://)              HTTP/HTTPS
                  │                              │
                  ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Server (Backend)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Express Application Layer (app.js)                   │   │
│  │ - HTTP routes (/api/login, /api/download, etc.)     │   │
│  │ - Static file serving (public/, src/client/)        │   │
│  │ - WebSocket upgrade handler                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲ ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Service Layer                                        │   │
│  │ - auth.js (SSH to localhost authentication)          │   │
│  │ - websocket.js (WS message routing & session mgmt)  │   │
│  │ - terminal.js (PTY channel management)              │   │
│  │ - filebrowser.js (SFTP file operations)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲ ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ External Libraries                                   │   │
│  │ - ssh2 (SSH client to localhost:22)                 │   │
│  │ - ws (WebSocket server)                             │   │
│  │ - express (HTTP server framework)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          SSH
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Linux System (localhost:22)                    │
│  - OpenSSH Server (authenticates users)                     │
│  - SFTP subsystem (file transfers)                          │
│  - Shell (bash/zsh for terminal PTYs)                       │
│  - User files and directories                              │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
1. User enters username + password in browser
                    │
                    ▼
2. Browser sends to /api/login (HTTP POST)
                    │
                    ▼
3. Server calls auth.authenticateUser()
                    │
                    ▼
4. Server initiates SSH connection to localhost:22
                    │
                    ▼
5. OpenSSH validates credentials against PAM/shadow
                    │
        ┌───────────┴───────────┐
        │                       │
   Success              Authentication Failed
        │                       │
        ▼                       ▼
6a. Create session      Return error to client
    Store SSH connection
    Return sessionId
        │
        ▼
7. Browser stores sessionId in localStorage
        │
        ▼
8. Browser connects WebSocket with ?sessionId=X
        │
        ▼
9. Server retrieves session from Map
        │
        ▼
10. Create 3 PTY channels on existing SSH connection
```

## Session Model

Each user session contains:
- `id`: Unique session identifier (UUID)
- `username`: Linux username
- `connection`: Active SSH connection object (ssh2 Client)
- `sftp`: SFTP client (created on-demand)
- `terminals`: Map of terminal objects {terminalId → {channel, cols, rows}}

Sessions are stored in-memory (server process RAM). When browser disconnects, session persists until logout or server restart.

## WebSocket Message Flow

### Terminal Creation
```javascript
Client: { type: 'terminal:create', payload: { terminalId: 'term-1' } }
  ↓
Server: Create PTY channel on SSH connection
Server: Send { type: 'terminal:ready', payload: { terminalId: 'term-1' } }
  ↓
Client: Attach xterm.js listeners
Client: Display terminal ready for input
```

### Terminal Input
```javascript
Client: User types in terminal
  ↓
xterm.js: Fires onData event
  ↓
Client: { type: 'terminal:input', payload: { terminalId, data } }
  ↓
Server: Write data to PTY channel
  ↓
PTY channel: Sends output back
  ↓
Server: { type: 'terminal:data', payload: { terminalId, data } }
  ↓
Client: Write data to xterm.js display
```

### File Listing
```javascript
Client: User navigates to /home/user
  ↓
Client: { type: 'file:list', payload: { path, requestId } }
  ↓
Server: Call filebrowser.listDirectory(session, path)
  ↓
SFTP: readdir() on remote filesystem
  ↓
Server: { type: 'file:list:response', payload: { requestId, files } }
  ↓
Client: Render file list in browser
```

## File Operations

All file operations use SFTP (SSH File Transfer Protocol) over the existing SSH connection.

### Download Flow
```
Client: User clicks download button
  ↓
Client: GET /api/download?sessionId=X&path=/home/user/file.txt
  ↓
Server: filebrowser.readFileBuffer(session, path)
  ↓
SFTP: readFile(path) → returns Buffer
  ↓
Server: Send Buffer with Content-Disposition: attachment
  ↓
Client: Receive blob, create ObjectURL, trigger <a download>
  ↓
Browser: Download file to Downloads folder
```

### Upload Flow
```
Client: User selects file(s) to upload
  ↓
Client: POST /api/upload?sessionId=X&path=/home/user
        Body: ArrayBuffer of file content
  ↓
Server: filebrowser.uploadFile(session, path, buffer)
  ↓
SFTP: writeFile(path, buffer)
  ↓
Server: Return { success: true }
  ↓
Client: Refresh file browser
```

## Theme System

Themes are managed via CSS variables and localStorage:

```javascript
localStorage.setItem('theme', 'light' or 'dark')
  ↓
App.applyTheme(theme)
  ↓
if (theme === 'light') document.body.classList.add('light-mode')
  ↓
CSS: body.light-mode { --bg-primary: #ffffff; ... }
  ↓
All components inherit CSS variables automatically
  ↓
For CodeMirror: Explicitly set theme: 'default' or 'material-darker'
  ↓
For xterm.js: Update terminal.options.theme object with colors
```

## Security Considerations

### Authentication
- No credentials stored on client (sessionId only)
- SSH credentials validated by OpenSSH on localhost
- Each user gets their own SSH connection to server

### Authorization
- File operations restricted to user's SSH home directory
- Navigation above home redirects to home (unless explicit "/" prompt)
- All file paths normalized before operations
- SFTP permissions enforced by OpenSSH

### Communication
- WebSockets should use WSS (wss://) in production (via reverse proxy)
- Session IDs are UUIDs (cryptographically random)
- No sensitive data in localStorage except sessionId
- Login credentials sent only in initial HTTP POST (HTTPS in production)

## Performance Optimizations

1. **SFTP Connection Pooling**: Single persistent SFTP connection per user session
2. **Message Batching**: WebSocket messages sent individually (no batch queuing)
3. **Terminal Buffer**: xterm.js handles scrollback internally (no server-side buffer)
4. **File Size Limits**: Express configured with 100MB upload limit
5. **Lazy Loading**: SFTP client created on first file operation
6. **Layout Caching**: Split pane sizes persisted to localStorage

## Error Handling

### Client Errors
- SSH authentication failure → show login error
- File not found → notification with error message
- Download/upload failure → fetch error handler shows message
- Terminal disconnect → display "[Terminal session closed]"

### Server Errors
- Invalid session → return 401 Unauthorized
- SFTP operation failure → return 500 with error details
- SSH connection loss → terminal notified, session marked invalid
- WebSocket disconnect → automatic reconnect with exponential backoff

