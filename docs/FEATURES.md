# Features Documentation

## Terminal Features

### Multiple Terminal Panes
- **Layout**: 1 large terminal (left) + 2 stacked terminals (right)
- **All Independent**: Each terminal is a separate SSH shell
- **Last Active Tracking**: The terminal you last clicked receives commands from file operations

### Font Size Control
- **Increase**: Ctrl+Plus or Cmd+Plus (+2pt)
- **Decrease**: Ctrl+Minus or Cmd+Minus (-2pt)
- **Reset**: Ctrl+Zero or Cmd+Zero (back to 14pt)
- **Persistence**: Font size saved to localStorage across sessions

### Terminal Cleanup
- Auto-clears "Last login" messages on connection
- Sends `clear` command after 600ms delay
- Happens for all 3 terminals
- Ensures clean prompt appearance

### Automatic Session Restoration
- Terminal data persists if browser tab stays open
- Reconnects WebSocket with exponential backoff on disconnect
- Reconnection attempts: 1s, 2s, 4s, 8s, 16s, 32s (max)

---

## File Browser Features

### File Listing
- **Sorting**: By modification time (newest first), directories above files
- **Filtering**: Dotfiles (.*) hidden by default
- **Icons**: File type indicators (documents, images, archives, etc.)
- **Info**: Modification date displayed for each file

### Navigation
- **Breadcrumb**: Click path segments to navigate
- **Root Prompt**: Click "/" to navigate to any path (prompted)
- **Home Restriction**: Breadcrumb clicks restricted to home directory tree
- **Redirect**: Navigation above home redirects back to home

### File Operations

#### Browse
- Double-click directory to open
- Single-click to select
- Right-click for context menu

#### Create
- **New File**: Toolbar button 📄, prompted for filename
- **New Folder**: Toolbar button 📁, prompted for folder name
- Creates in current directory with full user permissions

#### Upload
- **Toolbar Button**: ⬆ opens file picker (multi-select)
- **Max Size**: 100MB per file
- **Destination**: Current directory
- **Feedback**: Notification on success/failure

#### Download
- **Toolbar Button**: ⬇ downloads selected file
- **Context Menu**: "Download" option on any file
- **Binary Files**: Double-click downloads instead of editing
- **Limit**: Files only (not directories)

#### Edit
- **Double-click**: Opens in CodeMirror editor
- **Syntax Highlighting**: 20+ language modes auto-detected
- **Save**: Ctrl+S or Cmd+S, or Save button
- **Unsaved Changes**: Confirms before closing
- **Binary Files**: Skipped, download instead
- **Theme Integration**: Editor respects light/dark mode

#### Delete
- **Context Menu**: "Delete" option on files
- **Confirmation**: Confirms before deleting
- **Scope**: Files only (not directories from context menu)

#### Rename
- **Context Menu**: "Rename" on any file/folder
- **Prompt**: Modal input with current name
- **Result**: Renames in place, updates display

### Pandoc Integration

#### Supported Formats
Convertible to markdown:
- Documents: `.doc`, `.docx`, `.odt`, `.rtf`
- Presentations: `.ppt`, `.pptx`, `.odp`
- E-books: `.epub`
- Web: `.html`, `.htm`
- Markup: `.rst`, `.textile`, `.mediawiki`, `.org`, `.latex`, `.tex`

#### How to Use
1. Right-click on convertible file
2. Click "Convert to Markdown"
3. Command sent to last active terminal
4. Output file created: `filename.md` in same directory
5. File browser auto-refreshes after 2 seconds

#### Command Generated
```bash
pandoc "/full/path/to/file.docx" -o "/full/path/to/file.md"
```

**Note**: Requires pandoc installed on system (`apt install pandoc`).

---

## Editor Features

### CodeMirror Integration
- **Library**: CodeMirror 5 (reliable, lightweight)
- **Themes**: Material Darker (dark mode), Default (light mode)
- **Auto-Detect**: Language mode by file extension

### Supported Languages (20+)
JavaScript, TypeScript, JSX, JSON, Python, Shell/Bash, CSS, SCSS, HTML, XML, Markdown, YAML, SQL, Go, Rust, C/C++, Java, Ruby, PHP, Dockerfile, Perl, Lua, and plain text.

### Keyboard Shortcuts
- **Save**: Ctrl+S or Cmd+S
- **Line Numbers**: Always visible
- **Auto Indent**: 2-space indentation
- **Tab Size**: 2 spaces
- **Soft Tabs**: Indentation uses spaces, not tabs
- **Line Wrapping**: Enabled for long lines
- **Bracket Matching**: Highlights matching brackets
- **Auto Close**: Automatically closes brackets/quotes

### Editor Features
- **Syntax Highlighting**: Per-language highlighting with theme colors
- **Undo/Redo**: Full edit history (native CodeMirror)
- **Find/Replace**: Native Ctrl+F, Ctrl+H
- **Read-Only**: Some files can be opened read-only (future feature)
- **Modal**: Floating editor modal with close confirmation

---

## User Interface

### Dark Mode (Default)
- **Colors**: Dark grays, light text (#d4d4d4)
- **Accents**: Blues, greens for status
- **Background**: #1e1e1e primary, #2d2d30 secondary

### Light Mode
- **Colors**: White background, dark text (#1e1e1e)
- **Accents**: Darker blues, greens
- **Loading Overlay**: Light gray transparent

### Theme Toggle
- **Button**: Sun/moon icon in header
- **Location**: Top-right header
- **Persistence**: Saved to localStorage
- **Scope**: Affects entire UI including terminals and editor

### Layout Management
- **Resizable Panes**: Drag dividers to resize
- **Persistence**: Layout sizes saved to localStorage
- **Responsive**: Adapts to window resize

### Notifications
- **Success**: Green notifications for completed actions
- **Error**: Red notifications for failures
- **Info**: Blue notifications for status updates
- **Duration**: Auto-dismiss after 3 seconds (configurable)

### Dialogs
- **Confirm**: Yes/No for destructive actions (delete, etc.)
- **Prompt**: Text input for names, paths, etc.
- **Modal**: Blocks interaction until closed

---

## Security Features

### Authentication
- **SSH to Localhost**: No passwords stored locally
- **Session IDs**: UUID v4 (cryptographically random)
- **Validation**: Each request validates sessionId

### File Access Control
- **Home Directory**: Navigation restricted above home by default
- **SFTP Permissions**: File operations respect Linux permissions
- **Path Normalization**: All paths validated and normalized
- **Explicit Prompts**: "/" navigation requires confirmation

### Communication
- **WebSocket**: Should use WSS (wss://) in production via reverse proxy
- **Login**: Use HTTPS in production
- **Session**: Expires on server restart (in-memory storage)

---

## Advanced Features

### Last Active Terminal Tracking
- **Pandoc commands** sent to last clicked terminal
- **Terminal focus** tracked across all 3 panes
- **Use case**: Run conversions in specific terminal

### Automatic File Type Detection
- **Binary Files**: Automatically downloaded instead of edited
- **Recognized Types**: Images, videos, audio, archives, documents, executables, fonts
- **Text Files**: Opened in editor by default

### Error Handling
- **Graceful Degradation**: UI stays responsive during errors
- **User Feedback**: Every action shows success/error notification
- **Logging**: Console logs available in browser DevTools
- **Server Logs**: Node.js logs show all operations

### Performance
- **Session Pooling**: SFTP connection reused per user
- **Lazy Loading**: SFTP created on first file operation
- **Terminal Buffering**: xterm.js manages its own scrollback
- **Layout Caching**: Sizes persisted to localStorage

---

## Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | Save file in editor |
| Ctrl/Cmd + = | Increase terminal font size |
| Ctrl/Cmd + - | Decrease terminal font size |
| Ctrl/Cmd + 0 | Reset terminal font size to 14pt |
| Ctrl/Cmd + F | Find in editor |
| Ctrl/Cmd + H | Replace in editor |
| Click "/" breadcrumb | Prompt for arbitrary path |
| Double-click folder | Navigate into folder |
| Double-click file | Edit file (or download if binary) |
| Right-click item | Context menu (delete, rename, download, convert) |

---

## Troubleshooting

### "Last login" messages appearing
- **Cause**: Terminal not auto-clearing
- **Fix**: Refresh page (clearing happens on connection)

### Terminal font size not changing
- **Cause**: Keyboard shortcut not registered
- **Fix**: Ensure terminal pane has focus (click terminal, then try shortcut)

### File won't download
- **Cause**: Browser blocking download or file too large
- **Fix**: Check browser console for errors, verify file exists

### Pandoc convert not working
- **Cause**: Pandoc not installed or file format not supported
- **Fix**: Install pandoc (`apt install pandoc`), check supported formats above

### Can't navigate above home
- **Expected**: Breadcrumb clicks redirect to home (security feature)
- **Workaround**: Click "/" breadcrumb and type full path explicitly

