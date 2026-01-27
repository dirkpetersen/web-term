const { getSession } = require('./auth');
const terminal = require('./terminal');
const fileBrowser = require('./filebrowser');

/**
 * Handle new WebSocket connection
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} sessionId - Session ID from query params
 */
function handleConnection(ws, sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    ws.close(1008, 'Invalid session');
    return;
  }

  // Clean up any existing terminals from previous connection (browser refresh)
  if (session.terminals.size > 0) {
    console.log(`Cleaning up ${session.terminals.size} old terminal(s) for session ${sessionId}`);
    for (const [terminalId, term] of session.terminals) {
      try {
        terminal.closeTerminalChannel(term, session);
      } catch (err) {
        console.error(`Error closing old terminal ${terminalId}:`, err);
      }
    }
    session.terminals.clear();
  }

  ws.sessionId = sessionId;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      await handleMessage(ws, session, message);
    } catch (err) {
      console.error('WebSocket message error:', err);
      sendMessage(ws, 'error', { message: err.message });
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, session);
  });

  sendMessage(ws, 'connected', { sessionId });
}

/**
 * Handle incoming WebSocket message
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} session - Session object
 * @param {Buffer|string} message - Message data
 */
async function handleMessage(ws, session, message) {
  const msg = JSON.parse(message.toString());
  const { type, payload } = msg;

  switch (type) {
    case 'terminal:create':
      await handleTerminalCreate(ws, session, payload);
      break;

    case 'terminal:input':
      handleTerminalInput(session, payload);
      break;

    case 'terminal:resize':
      handleTerminalResize(session, payload);
      break;

    case 'terminal:close':
      handleTerminalClose(session, payload);
      break;

    case 'file:list':
      await handleFileList(ws, session, payload);
      break;

    case 'file:read':
      await handleFileRead(ws, session, payload);
      break;

    case 'file:write':
      await handleFileWrite(ws, session, payload);
      break;

    case 'file:delete':
      await handleFileDelete(ws, session, payload);
      break;

    case 'file:rename':
      await handleFileRename(ws, session, payload);
      break;

    case 'file:mkdir':
      await handleFileMkdir(ws, session, payload);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
}

/**
 * Create new terminal channel
 */
async function handleTerminalCreate(ws, session, payload) {
  const { terminalId } = payload;
  const term = await terminal.createTerminalChannel(session, terminalId);

  terminal.onTerminalData(term, (data) => {
    if (data === null) {
      sendMessage(ws, 'terminal:closed', { terminalId });
    } else {
      sendMessage(ws, 'terminal:data', { terminalId, data });
    }
  });

  sendMessage(ws, 'terminal:ready', { terminalId });
}

/**
 * Handle terminal input from client
 */
function handleTerminalInput(session, payload) {
  const { terminalId, data } = payload;
  const term = session.terminals.get(terminalId);

  if (term) {
    terminal.writeToTerminal(term, data);
  }
}

/**
 * Handle terminal resize
 */
function handleTerminalResize(session, payload) {
  const { terminalId, cols, rows } = payload;
  const term = session.terminals.get(terminalId);

  if (term) {
    terminal.resizeTerminal(term, cols, rows);
  }
}

/**
 * Handle terminal close
 */
function handleTerminalClose(session, payload) {
  const { terminalId } = payload;
  const term = session.terminals.get(terminalId);

  if (term) {
    terminal.closeTerminalChannel(term, session);
  }
}

/**
 * Handle file list request
 */
async function handleFileList(ws, session, payload) {
  const { path, requestId } = payload;
  const files = await fileBrowser.listDirectory(session, path);
  sendMessage(ws, 'file:list:response', { requestId, path, files });
}

/**
 * Handle file read request
 */
async function handleFileRead(ws, session, payload) {
  const { path, requestId } = payload;
  const content = await fileBrowser.readFile(session, path);
  sendMessage(ws, 'file:read:response', { requestId, path, content });
}

/**
 * Handle file write request
 */
async function handleFileWrite(ws, session, payload) {
  const { path, content, requestId } = payload;
  await fileBrowser.writeFile(session, path, content);
  sendMessage(ws, 'file:write:response', { requestId, path, success: true });
}

/**
 * Handle file delete request
 */
async function handleFileDelete(ws, session, payload) {
  const { path, isDirectory, requestId } = payload;
  await fileBrowser.deleteItem(session, path, isDirectory);
  sendMessage(ws, 'file:delete:response', { requestId, path, success: true });
}

/**
 * Handle file rename request
 */
async function handleFileRename(ws, session, payload) {
  const { oldPath, newPath, requestId } = payload;
  await fileBrowser.renameItem(session, oldPath, newPath);
  sendMessage(ws, 'file:rename:response', { requestId, success: true });
}

/**
 * Handle create directory request
 */
async function handleFileMkdir(ws, session, payload) {
  const { path, requestId } = payload;
  await fileBrowser.createDirectory(session, path);
  sendMessage(ws, 'file:mkdir:response', { requestId, path, success: true });
}

/**
 * Handle WebSocket disconnect
 */
function handleDisconnect(ws, session) {
  console.log(`Client disconnected: ${session.username}`);
}

/**
 * Send formatted message to client
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} type - Message type
 * @param {Object} payload - Message payload
 */
function sendMessage(ws, type, payload) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify({ type, payload }));
  }
}

module.exports = {
  handleConnection,
  handleMessage,
  handleDisconnect,
  sendMessage
};
