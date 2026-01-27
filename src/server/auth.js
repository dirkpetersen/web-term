const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');

// Store active sessions in memory
const sessions = new Map();

/**
 * Authenticate user by connecting to localhost via SSH
 * @param {string} username - Linux username
 * @param {string} password - User password
 * @returns {Promise<Object>} Session object with id and SSH connection
 */
function authenticateUser(username, password) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      const sessionId = uuidv4();
      const session = {
        id: sessionId,
        username,
        connection: conn,
        createdAt: new Date(),
        terminals: new Map(),
        sftp: null
      };

      sessions.set(sessionId, session);
      resolve(session);
    });

    conn.on('error', (err) => {
      reject(new Error('Authentication failed: ' + err.message));
    });

    conn.connect({
      host: 'localhost',
      port: 22,
      username,
      password,
      readyTimeout: 10000
    });
  });
}

/**
 * Create a new session (wrapper for authenticateUser)
 * @param {string} username - Linux username
 * @param {Object} sshConnection - SSH connection object
 * @returns {Object} Session object
 */
function createSession(username, sshConnection) {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    username,
    connection: sshConnection,
    createdAt: new Date(),
    terminals: new Map(),
    sftp: null
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * Validate if a session exists and is active
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session is valid
 */
function validateSession(sessionId) {
  return sessions.has(sessionId);
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session object or null
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Destroy session and close SSH connection
 * @param {string} sessionId - Session ID
 */
function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    // Close all terminal channels
    for (const [terminalId, channel] of session.terminals) {
      try {
        channel.close();
      } catch (err) {
        console.error(`Error closing terminal ${terminalId}:`, err);
      }
    }

    // Close SFTP connection if exists
    if (session.sftp) {
      try {
        session.sftp.end();
      } catch (err) {
        console.error('Error closing SFTP:', err);
      }
    }

    // Close main SSH connection
    try {
      session.connection.end();
    } catch (err) {
      console.error('Error closing SSH connection:', err);
    }

    sessions.delete(sessionId);
  }
}

/**
 * Get all active sessions (for debugging)
 * @returns {Array} Array of session IDs
 */
function getActiveSessions() {
  return Array.from(sessions.keys());
}

module.exports = {
  authenticateUser,
  createSession,
  validateSession,
  getSession,
  destroySession,
  getActiveSessions
};
