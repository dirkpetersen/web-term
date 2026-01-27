/**
 * Main application entry point
 */
class App {
  constructor() {
    this.sessionId = null;
    this.username = null;
  }

  /**
   * Initialize the application
   */
  async initApp() {
    this.sessionId = getStoredSession();
    this.username = getStoredUsername();

    // Apply saved theme immediately
    const savedTheme = localStorage.getItem('theme') || 'dark';
    this.applyTheme(savedTheme);

    console.log('App init - sessionId:', this.sessionId, 'username:', this.username);

    if (!this.sessionId) {
      console.log('No session, showing login');
      this.showLoginScreen();
    } else {
      try {
        console.log('Session found, showing main screen');
        await this.showMainScreen();
        console.log('Main screen loaded successfully');
      } catch (err) {
        console.error('Failed to initialize main screen:', err);
        clearSession();
        this.showLoginScreen();
      }
    }
  }

  /**
   * Show login screen
   */
  showLoginScreen() {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '';
    renderLoginForm(appContainer);
  }

  /**
   * Show main application screen
   */
  async showMainScreen() {
    console.log('showMainScreen starting...');
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '';

    // Set up layout
    console.log('Setting up layout...');
    this.setupLayout();

    // Connect WebSocket
    console.log('Connecting WebSocket...');
    try {
      await wsClient.connect(this.sessionId);
      console.log('WebSocket connected');
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      throw new Error('Failed to connect: ' + err.message);
    }

    // Initialize components
    console.log('Initializing components...');
    this.initializeComponents();
    console.log('Components initialized');

    // Set up logout handler
    this.setupLogoutHandler();

    // Set up global resize handler
    this.handleGlobalResize();
  }

  /**
   * Set up the main layout
   */
  setupLayout() {
    const appContainer = document.getElementById('app');

    // Create header
    const header = document.createElement('div');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="app-title">
        <img src="/favicon.png" alt="Beaver" class="app-logo">
        <span>Web Terminal</span>
      </div>
      <div class="app-user">
        <button id="theme-toggle-btn" class="btn-icon" title="Toggle light/dark mode">
          <span id="theme-icon">☀️</span>
        </button>
        <span class="username">${this.username}</span>
        <button id="logout-btn" class="btn-icon" title="Logout">
          <span>🚪</span>
        </button>
      </div>
    `;

    // Create main content container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'main-content';
    contentContainer.className = 'app-content';

    appContainer.appendChild(header);
    appContainer.appendChild(contentContainer);

    // Initialize layout manager
    layoutManager.initLayout(contentContainer);
  }

  /**
   * Initialize all components
   */
  initializeComponents() {
    // Initialize editor
    console.log('Initializing editor...');
    editor.initEditor();

    // Initialize file browser
    console.log('Initializing file browser...');
    fileBrowser.initFileBrowser();

    // Initialize terminals
    console.log('Initializing terminals...');
    terminalManager.initTerminals();
    window.terminalManager = terminalManager; // Make globally accessible
    console.log('All components initialized');
  }

  /**
   * Set up logout handler
   */
  setupLogoutHandler() {
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.logout();
    });

    // Set up theme toggle
    this.initTheme();
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  /**
   * Initialize theme from localStorage
   */
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    this.applyTheme(savedTheme);
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme() {
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Apply theme to the app
   * @param {string} theme - 'light' or 'dark'
   */
  applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      const themeIcon = document.getElementById('theme-icon');
      if (themeIcon) themeIcon.textContent = '🌙';
    } else {
      document.body.classList.remove('light-mode');
      const themeIcon = document.getElementById('theme-icon');
      if (themeIcon) themeIcon.textContent = '☀️';
    }

    // Update terminal themes
    if (window.terminalManager && window.terminalManager.terminals) {
      const terminalTheme = theme === 'light' ? {
        background: '#ffffff',
        foreground: '#1e1e1e',
        cursor: '#1e1e1e',
        black: '#1e1e1e',
        red: '#cd3131',
        green: '#00bc7f',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5'
      } : {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      };

      window.terminalManager.terminals.forEach((terminal) => {
        terminal.options.theme = terminalTheme;
      });
    }
  }

  /**
   * Handle global window resize
   */
  handleGlobalResize() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (terminalManager) {
          terminalManager.fitAllTerminals();
        }
      }, 200);
    });
  }

  /**
   * Logout user
   */
  async logout() {
    const confirmed = await showConfirmDialog(
      'Logout',
      'Are you sure you want to logout?'
    );

    if (confirmed) {
      handleLogout();
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initApp();
});
