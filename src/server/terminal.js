/**
 * Create a new terminal shell channel on the SSH connection
 * @param {Object} session - Session object containing SSH connection
 * @param {string} terminalId - Unique terminal identifier
 * @returns {Promise<Object>} Terminal channel object
 */
function createTerminalChannel(session, terminalId) {
  return new Promise((resolve, reject) => {
    session.connection.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        return reject(new Error('Failed to create shell: ' + err.message));
      }

      const terminal = {
        id: terminalId,
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
 * Close terminal channel
 * @param {Object} terminal - Terminal object
 * @param {Object} session - Session object
 */
function closeTerminalChannel(terminal, session) {
  try {
    terminal.stream.close();
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

module.exports = {
  createTerminalChannel,
  resizeTerminal,
  closeTerminalChannel,
  writeToTerminal,
  onTerminalData
};
