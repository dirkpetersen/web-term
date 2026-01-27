require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const auth = require('./auth');
const websocketHandler = require('./websocket');
const fileBrowser = require('./filebrowser');

const PORT = process.env.PORT || 3000;

/**
 * Set up Express routes
 * @param {Express} app - Express application
 */
function setupRoutes(app) {
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../../public')));

  // Serve client-side JavaScript files from src directory
  app.use('/src', express.static(path.join(__dirname, '..')));

  // Parse JSON bodies
  app.use(express.json());

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const session = await auth.authenticateUser(username, password);

      res.json({
        success: true,
        sessionId: session.id,
        username: session.username
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(401).json({ error: err.message });
    }
  });

  // Logout endpoint
  app.post('/api/logout', (req, res) => {
    try {
      const { sessionId } = req.body;

      if (sessionId) {
        auth.destroySession(sessionId);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // File download endpoint
  app.get('/api/download', async (req, res) => {
    try {
      const { sessionId, path: filePath } = req.query;

      console.log('Download request:', { sessionId: sessionId?.substring(0, 8), filePath });

      if (!sessionId || !filePath) {
        return res.status(400).json({ error: 'sessionId and path required' });
      }

      const session = auth.getSession(sessionId);
      if (!session) {
        console.log('Invalid session for download');
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Read file content directly instead of streaming
      const content = await fileBrowser.readFileBuffer(session, filePath);
      const filename = path.basename(filePath);

      console.log('Sending file:', filename, 'size:', content.length);

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', content.length);
      res.send(content);
    } catch (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // File upload endpoint
  app.post('/api/upload', express.raw({ type: 'application/octet-stream', limit: '100mb' }), async (req, res) => {
    try {
      const { sessionId, path: filePath } = req.query;

      if (!sessionId || !filePath) {
        return res.status(400).json({ error: 'sessionId and path required' });
      }

      const session = auth.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      await fileBrowser.uploadFile(session, filePath, req.body);

      res.json({ success: true });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}

/**
 * Set up WebSocket server
 * @param {http.Server} server - HTTP server
 */
function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    websocketHandler.handleConnection(ws, sessionId);
  });

  // Ping clients to keep connections alive and detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

/**
 * Start the server
 * @param {number} port - Port number
 */
function startServer(port = PORT) {
  const app = express();
  const server = http.createServer(app);

  setupRoutes(app);
  setupWebSocket(server);

  server.listen(port, () => {
    console.log(`Web Terminal Server running on http://localhost:${port}`);
    console.log('Waiting for connections...');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  return server;
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer, setupRoutes, setupWebSocket };
