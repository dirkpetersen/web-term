/**
 * Get or create SFTP connection for session
 * @param {Object} session - Session object
 * @returns {Promise<Object>} SFTP connection
 */
function getSftp(session) {
  return new Promise((resolve, reject) => {
    if (session.sftp) {
      return resolve(session.sftp);
    }

    session.connection.sftp((err, sftp) => {
      if (err) {
        return reject(new Error('Failed to create SFTP connection: ' + err.message));
      }
      session.sftp = sftp;
      resolve(sftp);
    });
  });
}

/**
 * List directory contents
 * @param {Object} session - Session object
 * @param {string} path - Directory path
 * @returns {Promise<Array>} Array of file objects
 */
async function listDirectory(session, path) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) {
        return reject(new Error('Failed to list directory: ' + err.message));
      }

      const files = list.map(item => ({
        name: item.filename,
        isDirectory: item.longname.startsWith('d'),
        size: item.attrs.size,
        mtime: item.attrs.mtime * 1000,
        permissions: item.attrs.mode,
        owner: item.attrs.uid,
        group: item.attrs.gid
      }));

      resolve(files);
    });
  });
}

/**
 * Read file contents
 * @param {Object} session - Session object
 * @param {string} path - File path
 * @returns {Promise<string>} File contents
 */
async function readFile(session, path) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.readFile(path, 'utf8', (err, data) => {
      if (err) {
        return reject(new Error('Failed to read file: ' + err.message));
      }
      resolve(data);
    });
  });
}

/**
 * Write file contents
 * @param {Object} session - Session object
 * @param {string} path - File path
 * @param {string} content - File contents
 * @returns {Promise<void>}
 */
async function writeFile(session, path, content) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.writeFile(path, content, (err) => {
      if (err) {
        return reject(new Error('Failed to write file: ' + err.message));
      }
      resolve();
    });
  });
}

/**
 * Upload file from buffer
 * @param {Object} session - Session object
 * @param {string} path - Destination path
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<void>}
 */
async function uploadFile(session, path, buffer) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.writeFile(path, buffer, (err) => {
      if (err) {
        return reject(new Error('Failed to upload file: ' + err.message));
      }
      resolve();
    });
  });
}

/**
 * Get file stream for download
 * @param {Object} session - Session object
 * @param {string} path - File path
 * @returns {Promise<Stream>} Read stream
 */
async function downloadFile(session, path) {
  const sftp = await getSftp(session);
  const stream = sftp.createReadStream(path);
  return stream;
}

/**
 * Read file as buffer for download
 * @param {Object} session - Session object
 * @param {string} path - File path
 * @returns {Promise<Buffer>} File contents as buffer
 */
async function readFileBuffer(session, path) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.readFile(path, (err, data) => {
      if (err) {
        return reject(new Error('Failed to read file: ' + err.message));
      }
      resolve(data);
    });
  });
}

/**
 * Delete file or directory
 * @param {Object} session - Session object
 * @param {string} path - Path to delete
 * @param {boolean} isDirectory - Whether path is a directory
 * @returns {Promise<void>}
 */
async function deleteItem(session, path, isDirectory) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    const operation = isDirectory ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp);

    operation(path, (err) => {
      if (err) {
        return reject(new Error('Failed to delete: ' + err.message));
      }
      resolve();
    });
  });
}

/**
 * Create new directory
 * @param {Object} session - Session object
 * @param {string} path - Directory path
 * @returns {Promise<void>}
 */
async function createDirectory(session, path) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err) => {
      if (err) {
        return reject(new Error('Failed to create directory: ' + err.message));
      }
      resolve();
    });
  });
}

/**
 * Rename or move file/directory
 * @param {Object} session - Session object
 * @param {string} oldPath - Current path
 * @param {string} newPath - New path
 * @returns {Promise<void>}
 */
async function renameItem(session, oldPath, newPath) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        return reject(new Error('Failed to rename: ' + err.message));
      }
      resolve();
    });
  });
}

/**
 * Get file statistics
 * @param {Object} session - Session object
 * @param {string} path - File path
 * @returns {Promise<Object>} File stats
 */
async function getStats(session, path) {
  const sftp = await getSftp(session);

  return new Promise((resolve, reject) => {
    sftp.stat(path, (err, stats) => {
      if (err) {
        return reject(new Error('Failed to get stats: ' + err.message));
      }

      resolve({
        size: stats.size,
        mtime: stats.mtime * 1000,
        isDirectory: stats.isDirectory(),
        permissions: stats.mode
      });
    });
  });
}

module.exports = {
  listDirectory,
  readFile,
  writeFile,
  uploadFile,
  downloadFile,
  readFileBuffer,
  deleteItem,
  createDirectory,
  renameItem,
  getStats
};
