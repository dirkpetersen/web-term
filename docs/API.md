# API Documentation

## HTTP Endpoints

All HTTP endpoints expect `application/json` request/response bodies unless otherwise noted.

### Authentication

#### POST /api/login
Authenticate user via SSH to localhost.

**Request:**
```json
{
  "username": "john",
  "password": "secret123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john"
}
```

**Response (Error - 401):**
```json
{
  "error": "Authentication failed: connect ECONNREFUSED"
}
```

**Error Cases:**
- SSH server not running on localhost:22
- Invalid username or password
- User account locked or disabled

---

#### POST /api/logout
Terminate user session and close SSH connection.

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Success - 200):**
```json
{
  "success": true
}
```

**Error Cases:**
- Session already expired
- Invalid session ID

---

### File Operations

#### GET /api/download
Download a file from the server.

**Query Parameters:**
- `sessionId` (required): User session ID
- `path` (required): Full file path to download

**Example:**
```
GET /api/download?sessionId=550e8400-e29b-41d4-a716-446655440000&path=/home/john/document.pdf
```

**Response (Success - 200):**
- Content-Type: `application/octet-stream`
- Content-Disposition: `attachment; filename="document.pdf"`
- Body: File contents as binary data

**Response (Error - 401):**
```json
{
  "error": "Invalid session"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to read file: Permission denied"
}
```

**Error Cases:**
- File does not exist
- Permission denied
- Invalid session

---

#### POST /api/upload
Upload file(s) to the server.

**Query Parameters:**
- `sessionId` (required): User session ID
- `path` (required): Destination directory path

**Request:**
- Content-Type: `application/octet-stream`
- Body: Raw file binary data

**Example:**
```bash
curl -X POST \
  "http://localhost:3000/api/upload?sessionId=550e8400...&path=/home/john" \
  --data-binary @file.txt
```

**Response (Success - 200):**
```json
{
  "success": true
}
```

**Response (Error - 401):**
```json
{
  "error": "Invalid session"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to upload file: Permission denied"
}
```

**Limits:**
- Max file size: 100MB
- Upload path must be within user's home directory

---

### Health Check

#### GET /api/health
Check if server is running.

**Response (200):**
```json
{
  "status": "ok"
}
```

---

## WebSocket Protocol

Connect to: `ws://localhost:3000/?sessionId=YOUR_SESSION_ID`

WebSocket communication uses JSON messages with `type` and `payload` fields.

### Terminal Messages

#### terminal:create
Create a new PTY shell channel.

**Client Send:**
```json
{
  "type": "terminal:create",
  "payload": {
    "terminalId": "term-1"
  }
}
```

**Server Response:**
```json
{
  "type": "terminal:ready",
  "payload": {
    "terminalId": "term-1"
  }
}
```

---

#### terminal:input
Send user input (keystrokes) to terminal.

**Client Send:**
```json
{
  "type": "terminal:input",
  "payload": {
    "terminalId": "term-1",
    "data": "ls -la\n"
  }
}
```

**Server Broadcast (on all connected WS for this session):**
```json
{
  "type": "terminal:data",
  "payload": {
    "terminalId": "term-1",
    "data": "total 48\ndrwxr-xr-x 5 john users 4096 Jan 26 20:00 .\n..."
  }
}
```

---

#### terminal:resize
Send window size change to PTY.

**Client Send:**
```json
{
  "type": "terminal:resize",
  "payload": {
    "terminalId": "term-1",
    "cols": 120,
    "rows": 30
  }
}
```

No response from server (implicit success). If resize fails, terminal output may be corrupted.

---

#### terminal:close
Close terminal channel.

**Client Send:**
```json
{
  "type": "terminal:close",
  "payload": {
    "terminalId": "term-1"
  }
}
```

**Server Broadcast:**
```json
{
  "type": "terminal:closed",
  "payload": {
    "terminalId": "term-1"
  }
}
```

---

### File Messages

All file messages follow a request/response pattern using `requestId` for correlation.

#### file:list
List directory contents.

**Client Send:**
```json
{
  "type": "file:list",
  "payload": {
    "path": "/home/john",
    "requestId": 1
  }
}
```

**Server Response:**
```json
{
  "type": "file:list:response",
  "payload": {
    "requestId": 1,
    "files": [
      {
        "name": "document.pdf",
        "isDirectory": false,
        "size": 2048576,
        "mtime": 1705000000000,
        "permissions": 33188,
        "owner": 1000,
        "group": 1000
      },
      {
        "name": "projects",
        "isDirectory": true,
        "size": 4096,
        "mtime": 1705010000000,
        "permissions": 16877,
        "owner": 1000,
        "group": 1000
      }
    ]
  }
}
```

---

#### file:read
Read file contents as text.

**Client Send:**
```json
{
  "type": "file:read",
  "payload": {
    "path": "/home/john/script.sh",
    "requestId": 2
  }
}
```

**Server Response:**
```json
{
  "type": "file:read:response",
  "payload": {
    "requestId": 2,
    "content": "#!/bin/bash\necho 'Hello World'\n"
  }
}
```

**Error Response:**
```json
{
  "type": "file:read:response",
  "payload": {
    "requestId": 2,
    "error": "Failed to read file: No such file or directory"
  }
}
```

---

#### file:write
Write or create file with content.

**Client Send:**
```json
{
  "type": "file:write",
  "payload": {
    "path": "/home/john/notes.txt",
    "content": "My notes here",
    "requestId": 3
  }
}
```

**Server Response (Success):**
```json
{
  "type": "file:write:response",
  "payload": {
    "requestId": 3
  }
}
```

---

#### file:delete
Delete file or directory.

**Client Send:**
```json
{
  "type": "file:delete",
  "payload": {
    "path": "/home/john/old_file.txt",
    "isDirectory": false,
    "requestId": 4
  }
}
```

**Server Response:**
```json
{
  "type": "file:delete:response",
  "payload": {
    "requestId": 4
  }
}
```

---

#### file:rename
Rename or move file/directory.

**Client Send:**
```json
{
  "type": "file:rename",
  "payload": {
    "oldPath": "/home/john/old_name.txt",
    "newPath": "/home/john/new_name.txt",
    "requestId": 5
  }
}
```

**Server Response:**
```json
{
  "type": "file:rename:response",
  "payload": {
    "requestId": 5
  }
}
```

---

#### file:mkdir
Create new directory.

**Client Send:**
```json
{
  "type": "file:mkdir",
  "payload": {
    "path": "/home/john/new_folder",
    "requestId": 6
  }
}
```

**Server Response:**
```json
{
  "type": "file:mkdir:response",
  "payload": {
    "requestId": 6
  }
}
```

---

## Error Handling

### HTTP Errors
- **400 Bad Request**: Missing required parameters
- **401 Unauthorized**: Invalid or expired session ID
- **500 Internal Server Error**: Server-side error (see error message for details)

### WebSocket Errors
- Errors are sent as responses with `error` field in payload
- Invalid JSON closes connection
- Unknown message type is ignored
- Closed connection triggers automatic client reconnect with exponential backoff

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid session" | Session ID not recognized or expired | Log in again |
| "Failed to read file: Permission denied" | File permissions restrict access | Check file permissions |
| "Failed to read file: No such file or directory" | Path doesn't exist | Verify path |
| "connect ECONNREFUSED" | SSH server not running on localhost:22 | Start SSH service |

---

## Session Management

### Session Lifetime
- Created on successful login
- Expires after server restart
- Persists across WebSocket disconnections
- Can have multiple WebSocket connections per session (not recommended)

### Multiple Terminals
- Each session can have multiple terminal channels (3 recommended)
- Terminal IDs: `term-1`, `term-2`, `term-3`
- Each terminal is independent (separate PTY)
- Terminal data is sent to all WebSocket clients for that session

### Cleanup
- Manual logout: `POST /api/logout` closes SSH connection
- Automatic: Server restart, SSH connection timeout (system-dependent)

