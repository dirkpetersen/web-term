# Multi-Tab Implementation Analysis for Web-Term

This document analyzes approaches for implementing multi-tab functionality in web-term, similar to Windows Terminal's tab system.

## Current Architecture

```
User Session (1 browser tab)
└── 3 tmux sessions
    ├── webterm-{username}-main
    ├── webterm-{username}-top
    └── webterm-{username}-bottom
```

**Current logout behavior**: Kills all tmux sessions matching `webterm-{username}-*`

## The Challenge

If we add tabs, each tab needs its own set of 3 terminals. The key challenges:

1. **Session isolation**: Each tab's terminals must be independent
2. **Selective logout**: Closing one tab should only kill that tab's tmux sessions
3. **Session naming**: Need a scheme to identify which tmux sessions belong to which tab
4. **Persistence**: Should tabs themselves persist across browser refresh?

---

## Option 1: Multiple Browser Tabs

Use the browser's native tab functionality. Each browser tab is an independent web-term instance.

### Architecture
```
Browser Tab 1 → Session A → webterm-{username}-{sessionA}-main/top/bottom
Browser Tab 2 → Session B → webterm-{username}-{sessionB}-main/top/bottom
Browser Tab 3 → Session C → webterm-{username}-{sessionC}-main/top/bottom
```

### Implementation

**Tmux naming scheme:**
```
webterm-{username}-{sessionId}-{pane}

Examples:
webterm-jimmy-a1b2c3d4-main
webterm-jimmy-a1b2c3d4-top
webterm-jimmy-a1b2c3d4-bottom
webterm-jimmy-e5f6g7h8-main
webterm-jimmy-e5f6g7h8-top
webterm-jimmy-e5f6g7h8-bottom
```

**Logout behavior:**
- Close browser tab → tmux sessions persist (can reconnect)
- Click logout button → kill only `webterm-{username}-{sessionId}-*`
- "Logout all" option → kill all `webterm-{username}-*`

**Code changes required:**
1. Update `getTmuxSessionName()` to include sessionId:
   ```javascript
   function getTmuxSessionName(username, sessionId, terminalId) {
     const suffix = TMUX_SESSION_NAMES[terminalId] || terminalId;
     return `webterm-${username}-${sessionId.substring(0, 8)}-${suffix}`;
   }
   ```

2. Update `killAllUserTmuxSessions()` to accept optional sessionId:
   ```javascript
   async function killTabTmuxSessions(session, sessionId) {
     const prefix = `webterm-${session.username}-${sessionId.substring(0, 8)}-`;
     // Kill only sessions with this prefix
   }
   ```

3. Add session recovery on page load (reconnect to existing tmux sessions)

### Pros
- **Zero UI changes**: Browser handles tab management
- **Native behavior**: Users already know how to use browser tabs
- **Independent sessions**: Each tab has its own WebSocket, own sessionId
- **Simple implementation**: Mostly just change tmux naming scheme
- **Memory isolation**: Each tab is separate browser context

### Cons
- **No tab persistence**: Browser tabs don't survive browser restart
- **No cross-tab awareness**: Can't see all tabs in one view
- **Duplicate login**: Each tab requires separate login (unless using shared auth)
- **Resource heavy**: Each tab has full app overhead

### Effort Estimate
- **Low effort**: ~2-4 hours
- Changes: tmux naming, selective logout, session recovery

---

## Option 2: In-App Tabs (Like Windows Terminal)

Implement a tab bar within the web-term application. Single browser tab, multiple in-app tabs.

### Architecture
```
Browser Tab
└── Web-Term App
    └── Tab Bar
        ├── Tab 1 → webterm-{username}-tab1-main/top/bottom
        ├── Tab 2 → webterm-{username}-tab2-main/top/bottom
        └── Tab 3 → webterm-{username}-tab3-main/top/bottom
```

### Implementation

**UI Structure:**
```html
<div class="app-container">
  <div class="tab-bar">
    <div class="tab active" data-tab-id="tab1">Tab 1 <span class="close">×</span></div>
    <div class="tab" data-tab-id="tab2">Tab 2 <span class="close">×</span></div>
    <button class="new-tab">+</button>
  </div>
  <div class="tab-content">
    <!-- Terminal panes for active tab -->
  </div>
</div>
```

**Tmux naming scheme:**
```
webterm-{username}-tab{N}-{pane}

Examples:
webterm-jimmy-tab1-main
webterm-jimmy-tab1-top
webterm-jimmy-tab1-bottom
webterm-jimmy-tab2-main
...
```

**State management:**
```javascript
class TabManager {
  constructor() {
    this.tabs = new Map(); // tabId -> { terminals, active }
    this.activeTabId = null;
  }

  createTab() {
    const tabId = `tab${this.tabs.size + 1}`;
    // Create 3 terminals for this tab
    // Update tab bar UI
  }

  switchTab(tabId) {
    // Hide current tab's terminals
    // Show new tab's terminals
    // Update active state
  }

  closeTab(tabId) {
    // Kill tmux sessions for this tab only
    // Remove from UI
    // Switch to another tab
  }
}
```

**Code changes required:**

1. **New TabManager class** (~150 lines):
   - Tab creation, switching, closing
   - State persistence to localStorage
   - Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)

2. **Update TerminalManager**:
   - Support multiple terminal sets (one per tab)
   - Track which terminals belong to which tab

3. **Update Layout**:
   - Add tab bar to header
   - Handle tab content switching

4. **Update tmux naming**:
   - Include tab identifier in session names

5. **CSS for tab bar** (~50 lines):
   - Tab styling, active state, close buttons, hover effects

6. **Keyboard shortcuts**:
   ```
   Ctrl+T        → New tab
   Ctrl+W        → Close current tab
   Ctrl+Tab      → Next tab
   Ctrl+Shift+Tab → Previous tab
   Ctrl+1-9      → Switch to tab N
   ```

### Pros
- **Single login**: One session, multiple tabs
- **Tab persistence**: Tabs can survive browser refresh (stored in localStorage + tmux)
- **Cross-tab awareness**: See all tabs, drag to reorder, etc.
- **Windows Terminal parity**: Familiar UX for Windows users
- **Resource efficient**: Single WebSocket, single session

### Cons
- **Significant UI work**: Tab bar, switching logic, state management
- **Complexity**: More code to maintain
- **Single point of failure**: If browser tab crashes, all tabs gone
- **WebSocket multiplexing**: Need to route terminal data to correct tab

### Effort Estimate
- **Medium effort**: ~8-16 hours
- New components: TabManager, tab bar UI, CSS
- Updates: TerminalManager, Layout, tmux naming, keyboard shortcuts

---

## Option 3: Hybrid Approach

Support both browser tabs AND in-app tabs.

### Architecture
```
Browser Tab 1
└── Web-Term App (Session A)
    ├── In-App Tab 1 → webterm-{username}-{sessionA}-tab1-main/top/bottom
    └── In-App Tab 2 → webterm-{username}-{sessionA}-tab2-main/top/bottom

Browser Tab 2
└── Web-Term App (Session B)
    ├── In-App Tab 1 → webterm-{username}-{sessionB}-tab1-main/top/bottom
    └── In-App Tab 2 → webterm-{username}-{sessionB}-tab2-main/top/bottom
```

### Tmux naming scheme
```
webterm-{username}-{sessionId}-tab{N}-{pane}

Examples:
webterm-jimmy-a1b2c3d4-tab1-main
webterm-jimmy-a1b2c3d4-tab1-top
webterm-jimmy-a1b2c3d4-tab2-main
webterm-jimmy-e5f6g7h8-tab1-main
```

### Logout hierarchy
```
Close in-app tab    → Kill webterm-{username}-{sessionId}-tab{N}-*
Logout (button)     → Kill webterm-{username}-{sessionId}-*
Logout all sessions → Kill webterm-{username}-*
```

### Pros
- **Maximum flexibility**: Users choose their workflow
- **Best of both worlds**: Browser isolation + in-app organization

### Cons
- **Most complex**: All the work of Option 2 plus Option 1
- **Confusing UX**: Too many ways to organize

### Effort Estimate
- **High effort**: ~16-24 hours

---

## Recommendation

### Start with Option 1 (Multiple Browser Tabs)

**Rationale:**
1. **Lowest effort**: Just change tmux naming scheme
2. **Already works**: Users can open multiple browser tabs now
3. **Foundation for Option 2**: The tmux naming changes apply to both
4. **Progressive enhancement**: Add in-app tabs later if needed

### Implementation Steps for Option 1

#### Step 1: Update tmux naming (30 min)
```javascript
// src/server/terminal.js
function getTmuxSessionName(username, sessionId, terminalId) {
  const suffix = TMUX_SESSION_NAMES[terminalId] || terminalId;
  // Use first 8 chars of sessionId for readability
  return `webterm-${username}-${sessionId.substring(0, 8)}-${suffix}`;
}
```

#### Step 2: Update session creation (30 min)
```javascript
// Pass sessionId to terminal creation
function createTerminalChannel(session, terminalId) {
  const tmuxSession = getTmuxSessionName(session.username, session.id, terminalId);
  // ...
}
```

#### Step 3: Update logout to be session-specific (30 min)
```javascript
// src/server/terminal.js
async function killSessionTmuxSessions(session) {
  const prefix = `webterm-${session.username}-${session.id.substring(0, 8)}-`;
  // Kill only this session's tmux sessions
}

async function killAllUserTmuxSessions(session) {
  const prefix = `webterm-${session.username}-`;
  // Kill ALL user's tmux sessions (for "logout everywhere")
}
```

#### Step 4: Add session recovery (1-2 hours)
```javascript
// On WebSocket connect, check for existing tmux sessions
async function recoverExistingTerminals(session) {
  const existingSessions = await listTmuxSessions(session);
  const sessionPrefix = `webterm-${session.username}-${session.id.substring(0, 8)}-`;

  const myTerminals = existingSessions.filter(s => s.startsWith(sessionPrefix));

  if (myTerminals.length > 0) {
    // Reattach to existing sessions instead of creating new ones
  }
}
```

#### Step 5: Add "Logout All Sessions" option (30 min)
```javascript
// UI: Add dropdown or second button
// "Logout" → kills current session's tmux
// "Logout All Sessions" → kills all user's tmux sessions
```

### Future: Add Option 2 (In-App Tabs)

Once Option 1 is solid, adding in-app tabs becomes easier because:
- Tmux naming already supports multiple "instances"
- Just need to add tab UI and manage multiple terminal sets per session
- Can reuse the selective logout logic

---

## Tmux Session Management Summary

### Current
```
Pattern: webterm-{username}-{pane}
Logout:  Kill webterm-{username}-*
```

### After Option 1
```
Pattern: webterm-{username}-{sessionId}-{pane}
Close tab: Sessions persist (can reconnect)
Logout:    Kill webterm-{username}-{sessionId}-*
Logout all: Kill webterm-{username}-*
```

### After Option 2 (future)
```
Pattern: webterm-{username}-{sessionId}-tab{N}-{pane}
Close in-app tab: Kill webterm-{username}-{sessionId}-tab{N}-*
Logout:           Kill webterm-{username}-{sessionId}-*
Logout all:       Kill webterm-{username}-*
```

---

## Key Insight: The Prefix Pattern

The solution to "don't kill everyone's sessions" is a **hierarchical naming scheme**:

```
webterm-{user}-{session}-{tab}-{pane}
        │       │         │      │
        │       │         │      └── main, top, bottom
        │       │         └── tab1, tab2, ... (optional, for in-app tabs)
        │       └── 8-char session ID (unique per browser tab)
        └── username
```

Each level allows selective killing:
- Kill one pane: `tmux kill-session -t webterm-jimmy-a1b2c3d4-tab1-main`
- Kill one tab: `tmux kill-session -t` all matching `webterm-jimmy-a1b2c3d4-tab1-*`
- Kill one browser session: all matching `webterm-jimmy-a1b2c3d4-*`
- Kill all user sessions: all matching `webterm-jimmy-*`

This pattern scales to any future granularity needs.
