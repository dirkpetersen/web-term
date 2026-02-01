/**
 * Terminal session management with tmux persistence
 *
 * Each user gets 3 named tmux sessions that persist across disconnects:
 * - webterm-{username}-main (left terminal)
 * - webterm-{username}-top (top-right terminal)
 * - webterm-{username}-bottom (bottom-right terminal)
 */

// Map terminal IDs to tmux session names
const TMUX_SESSION_NAMES = {
  'term-1': 'main',
  'term-2': 'top',
  'term-3': 'bottom'
};

// Hide tmux status bar by default (can be overridden in .env)
const TMUX_SHOW_STATUS = process.env.TMUX_SHOW_STATUS === 'true';

/**
 * Get tmux session name for a terminal
 * @param {string} username - Linux username
 * @param {string} terminalId - Terminal identifier (term-1, term-2, term-3)
 * @returns {string} tmux session name
 */
function getTmuxSessionName(username, terminalId) {
  const suffix = TMUX_SESSION_NAMES[terminalId] || terminalId;
  return `webterm-${username}-${suffix}`;
}

/**
 * Create a new terminal channel that attaches to a tmux session
 * Uses "tmux new-session -A" which attaches if exists, creates if not
 * @param {Object} session - Session object containing SSH connection
 * @param {string} terminalId - Unique terminal identifier
 * @returns {Promise<Object>} Terminal channel object
 */
function createTerminalChannel(session, terminalId) {
  return new Promise((resolve, reject) => {
    const tmuxSession = getTmuxSessionName(session.username, terminalId);

    // tmux new-session -A: attach if exists, create if not
    // -s: session name
    // set status off: hide tmux status bar (user doesn't need to know about tmux)
    const statusOpt = TMUX_SHOW_STATUS ? '' : '\\; set status off';
    const tmuxCmd = `tmux new-session -A -s ${tmuxSession} ${statusOpt}`;

    console.log(`Creating tmux session: ${tmuxSession}`);

    // Use exec with pty option instead of shell
    session.connection.exec(tmuxCmd, { pty: { term: 'xterm-256color' } }, (err, stream) => {
      if (err) {
        return reject(new Error('Failed to create tmux session: ' + err.message));
      }

      const terminal = {
        id: terminalId,
        tmuxSession,
        stream,
        cols: 80,
        rows: 24
      };

      session.terminals.set(terminalId, terminal);
      resolve(terminal);
    });
  });
}

/**
 * Resize terminal window
 * @param {Object} terminal - Terminal object with stream
 * @param {number} cols - Number of columns
 * @param {number} rows - Number of rows
 */
function resizeTerminal(terminal, cols, rows) {
  try {
    terminal.stream.setWindow(rows, cols, 0, 0);
    terminal.cols = cols;
    terminal.rows = rows;
  } catch (err) {
    console.error('Error resizing terminal:', err);
  }
}

/**
 * Close terminal channel (detaches from tmux, doesn't kill session)
 * @param {Object} terminal - Terminal object
 * @param {Object} session - Session object
 */
function closeTerminalChannel(terminal, session) {
  try {
    // Send tmux detach command before closing
    // This ensures clean detach rather than abrupt disconnect
    terminal.stream.write('\x02d'); // Ctrl+B, d (tmux detach)

    setTimeout(() => {
      try {
        terminal.stream.close();
      } catch (e) {
        // Stream may already be closed
      }
    }, 100);

    session.terminals.delete(terminal.id);
  } catch (err) {
    console.error('Error closing terminal channel:', err);
  }
}

/**
 * Write data to terminal (user input)
 * @param {Object} terminal - Terminal object
 * @param {string} data - Data to write
 */
function writeToTerminal(terminal, data) {
  try {
    terminal.stream.write(data);
  } catch (err) {
    console.error('Error writing to terminal:', err);
  }
}

/**
 * Register callback for terminal output data
 * @param {Object} terminal - Terminal object
 * @param {Function} callback - Callback function(data)
 */
function onTerminalData(terminal, callback) {
  terminal.stream.on('data', (data) => {
    callback(data.toString('utf8'));
  });

  terminal.stream.on('close', () => {
    callback(null); // Signal channel closed
  });

  terminal.stream.stderr.on('data', (data) => {
    callback(data.toString('utf8'));
  });
}

/**
 * List existing tmux sessions for a user
 * @param {Object} session - Session object containing SSH connection
 * @returns {Promise<Array>} List of tmux session names
 */
function listTmuxSessions(session) {
  return new Promise((resolve, reject) => {
    const prefix = `webterm-${session.username}-`;

    session.connection.exec(`tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^${prefix}" || true`, (err, stream) => {
      if (err) {
        return resolve([]); // No sessions or tmux not available
      }

      let output = '';
      stream.on('data', (data) => {
        output += data.toString();
      });

      stream.on('close', () => {
        const sessions = output.trim().split('\n').filter(s => s.length > 0);
        resolve(sessions);
      });
    });
  });
}

/**
 * Kill a specific tmux session
 * @param {Object} session - Session object containing SSH connection
 * @param {string} tmuxSessionName - Name of tmux session to kill
 * @returns {Promise<void>}
 */
function killTmuxSession(session, tmuxSessionName) {
  return new Promise((resolve, reject) => {
    session.connection.exec(`tmux kill-session -t ${tmuxSessionName} 2>/dev/null || true`, (err, stream) => {
      if (err) {
        return resolve(); // Ignore errors
      }
      stream.on('close', () => resolve());
    });
  });
}

/**
 * Kill all tmux sessions for a user (for clean logout)
 * @param {Object} session - Session object containing SSH connection
 * @returns {Promise<void>}
 */
async function killAllUserTmuxSessions(session) {
  const prefix = `webterm-${session.username}-`;
  console.log(`Killing all tmux sessions with prefix: ${prefix}`);

  return new Promise((resolve) => {
    // Kill all matching sessions in a single command to avoid connection issues
    // when individual session kills disrupt the SSH connection
    const cmd = `tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^${prefix}" | xargs -r -I {} tmux kill-session -t {} 2>/dev/null; echo done`;

    session.connection.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Error executing tmux kill command:', err);
        return resolve();
      }

      stream.on('data', (data) => {
        console.log('tmux kill output:', data.toString().trim());
      });

      stream.on('close', () => {
        console.log('All tmux sessions killed');
        resolve();
      });

      // Timeout in case something hangs
      setTimeout(() => {
        console.log('tmux kill timeout, continuing...');
        resolve();
      }, 5000);
    });
  });
}

module.exports = {
  createTerminalChannel,
  resizeTerminal,
  closeTerminalChannel,
  writeToTerminal,
  onTerminalData,
  getTmuxSessionName,
  listTmuxSessions,
  killTmuxSession,
  killAllUserTmuxSessions
};
