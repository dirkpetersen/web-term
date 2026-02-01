/**
 * Render login form
 * @param {HTMLElement} container - Container element
 */
function renderLoginForm(container) {
  container.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <h1 class="login-title">Web Terminal</h1>
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              autocomplete="username"
              required
              autofocus
            >
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              autocomplete="current-password"
              required
            >
          </div>
          <div class="form-group">
            <button type="submit" class="btn-primary" id="login-btn">
              Login
            </button>
          </div>
          <div id="login-error" class="error-message" style="display: none;"></div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value;
    const password = form.password.value;
    await handleLoginSubmit(username, password);
  });
}

/**
 * Handle login form submission
 * @param {string} username - Username
 * @param {string} password - Password
 */
async function handleLoginSubmit(username, password) {
  const loginBtn = document.getElementById('login-btn');
  const errorDiv = document.getElementById('login-error');

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    errorDiv.style.display = 'none';

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    storeSession(data.sessionId, data.username);
    window.location.reload();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = 'block';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  console.log('handleLogout called');
  const sessionId = getStoredSession();
  console.log('sessionId:', sessionId);

  // Prevent WebSocket reconnection attempts during logout
  if (window.wsClient) {
    window.wsClient.intentionalDisconnect = true;
  }

  // Clear session first to ensure we go to login on reload
  clearSession();
  console.log('Session cleared');

  if (sessionId) {
    try {
      console.log('Calling /api/logout...');
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      });
      console.log('Logout response:', response.status);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  console.log('About to reload...');
  window.location.reload();
}

/**
 * Store session in localStorage
 * @param {string} sessionId - Session ID
 * @param {string} username - Username
 */
function storeSession(sessionId, username) {
  localStorage.setItem('sessionId', sessionId);
  localStorage.setItem('username', username);
}

/**
 * Get stored session from localStorage
 * @returns {string|null} Session ID or null
 */
function getStoredSession() {
  return localStorage.getItem('sessionId');
}

/**
 * Get stored username from localStorage
 * @returns {string|null} Username or null
 */
function getStoredUsername() {
  return localStorage.getItem('username');
}

/**
 * Clear session from localStorage
 */
function clearSession() {
  localStorage.removeItem('sessionId');
  localStorage.removeItem('username');
}
