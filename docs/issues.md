# Issues Encountered and Solutions

This document tracks issues encountered during web-term development and their resolutions.

---

## Issue 1: Logout Only Closes Active Terminal

### Problem
When clicking logout, only the terminal with focus showed `[exited]` and `[Terminal session closed]`. The other two terminals remained connected and the user stayed on the main screen instead of being redirected to login.

### Root Cause
The `killAllUserTmuxSessions()` function was killing tmux sessions one-by-one in a loop:

```javascript
// BROKEN: Sequential kills disrupted SSH connection
async function killAllUserTmuxSessions(session) {
  const sessions = await listTmuxSessions(session);
  for (const tmuxSession of sessions) {
    await killTmuxSession(session, tmuxSession);  // Connection dies after first kill
  }
}
```

When the first tmux session was killed, it disrupted the SSH connection (the stream attached to that session closed), preventing the remaining `kill-session` commands from executing.

### Solution
Kill all tmux sessions in a single shell command:

```javascript
// FIXED: Single command kills all sessions atomically
async function killAllUserTmuxSessions(session) {
  const prefix = `webterm-${session.username}-`;
  const cmd = `tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^${prefix}" | xargs -r -I {} tmux kill-session -t {} 2>/dev/null; echo done`;

  session.connection.exec(cmd, (err, stream) => {
    // Handle completion
  });
}
```

### Files Changed
- `src/server/terminal.js`: Rewrote `killAllUserTmuxSessions()`

### Debugging Process
1. Added console.log statements to trace execution flow
2. Used Puppeteer to automate login/logout and capture browser console
3. Discovered `/api/logout` request was sent but never received response
4. Server log showed it killed first tmux session then stopped
5. Identified the race condition with SSH connection stability

---

## Issue 2: CodeMirror Dockerfile Mode Error

### Problem
Browser console showed:
```
Uncaught TypeError: e.defineSimpleMode is not a function
dockerfile.js:35
```

This JavaScript error broke page initialization, preventing logout and other functionality from working.

### Root Cause
The CodeMirror `dockerfile` mode depends on the `simple` mode addon, which wasn't loaded.

### Solution
Added the simple mode addon before loading language modes:

```html
<!-- Added this line -->
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/mode/simple.min.js"></script>
<!-- Language modes -->
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/dockerfile/dockerfile.min.js"></script>
```

### Files Changed
- `public/index.html`: Added simple.min.js addon

---

## Issue 3: Keyboard Shortcuts Passed to Terminal

### Problem
When pressing `Shift+Alt+Arrow` keys for pane resizing, the terminal received the keystrokes instead of the layout manager, resulting in characters like `CCCCCCCCCDDDDDDDDD` appearing in the terminal.

### Root Cause
The keyboard event listener was added in the bubble phase (default), which fires after the terminal has already processed the event.

### Solution
Use the capture phase to intercept events before they reach the terminal:

```javascript
// BROKEN: Bubble phase - terminal gets event first
document.addEventListener('keydown', (e) => { ... });

// FIXED: Capture phase - intercept before terminal
document.addEventListener('keydown', (e) => {
  if (!e.shiftKey || !e.altKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Handle resize...
}, true);  // true = capture phase
```

### Files Changed
- `src/client/layout.js`: Added `true` parameter to addEventListener, added stopImmediatePropagation()

---

## Issue 4: WebSocket Reconnection During Logout

### Problem
During logout, the WebSocket would attempt to reconnect, potentially interfering with the logout flow.

### Root Cause
The WebSocket client had automatic reconnection logic that triggered on any disconnect, including intentional logout.

### Solution
Added an `intentionalDisconnect` flag to prevent reconnection during logout:

```javascript
// websocket.js
class WebSocketClient {
  constructor() {
    this.intentionalDisconnect = false;
    // ...
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  attemptReconnect() {
    if (this.intentionalDisconnect) {
      return;  // Don't reconnect during logout
    }
    // ... normal reconnect logic
  }
}

// auth.js - set flag before logout
async function handleLogout() {
  if (window.wsClient) {
    window.wsClient.intentionalDisconnect = true;
  }
  // ... continue logout
}
```

### Files Changed
- `src/client/websocket.js`: Added `intentionalDisconnect` flag
- `src/client/auth.js`: Set flag during logout

---

## Issue 5: Server Process Respawning During Development

### Problem
When trying to restart the server to test changes, multiple server processes kept appearing, making it difficult to test with fresh code.

### Root Cause
`nodemon` was running in development mode and automatically restarting the server on file changes. Kill commands were racing with nodemon's restart.

### Solution
For testing, either:
1. Stop nodemon and run server directly: `node src/server/app.js`
2. Or make code changes and let nodemon restart automatically

### Lesson Learned
Be aware of development tooling (nodemon, webpack-dev-server, etc.) when debugging server-side issues.

---

## Issue 6: Logout API Request Never Completing

### Problem
Browser showed `Calling /api/logout...` in console but never showed `Logout response: 200` or `About to reload...`.

### Root Cause
Same as Issue 1 - the server-side logout was hanging because the SSH connection became unstable during sequential tmux kills.

### Debugging with Puppeteer
Created automated test script to capture exact sequence:

```javascript
const puppeteer = require('puppeteer');

// Capture all console logs
page.on('console', msg => console.log('BROWSER:', msg.text()));

// Capture network requests
page.on('request', req => console.log('REQUEST:', req.url()));
page.on('response', res => console.log('RESPONSE:', res.status(), res.url()));
```

This revealed:
- `REQUEST: POST /api/logout` was sent
- `RESPONSE` never came
- `About to reload...` never logged

### Solution
Fixed by Issue 1 solution (atomic tmux kill).

---

## Debugging Tips for Future Issues

### 1. Add Strategic Logging
```javascript
console.log(`destroySession called for ${session.username}, killTmux=${killTmux}`);
console.log(`Session has ${session.terminals.size} terminal(s)`);
```

### 2. Use Puppeteer for Browser Automation
```bash
npm install puppeteer
node test-script.js
```

### 3. Check Server Logs
```bash
node src/server/app.js > /tmp/webterm.log 2>&1 &
tail -f /tmp/webterm.log
```

### 4. Test APIs with curl
```bash
curl -s -X POST http://localhost:3000/api/logout \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123"}'
```

### 5. Check tmux Sessions
```bash
tmux list-sessions
# or for another user
sudo -u jimmy tmux list-sessions
```

### 6. Event Capture vs Bubble
When keyboard events are being "eaten" by a component:
- Use capture phase (`addEventListener(..., true)`)
- Call `stopImmediatePropagation()` to prevent all other handlers
