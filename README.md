# Web Terminal

A modern, web-based Linux terminal application with an integrated file browser. Access your Linux system through a browser with native SSH authentication.

## Features

- **Dual Terminal Panes**: Two vertically stacked terminal sessions in one view
- **Integrated File Browser**: Browse, upload, download, edit, and manage files
- **Native Linux Authentication**: Uses SSH for secure, standard Linux authentication
- **Dark Mode UI**: Polished, modern dark theme interface
- **No Root Required**: Runs as a regular user with `systemd --user`
- **Real-time Communication**: WebSocket-based terminal and file operations
- **File Editor**: Built-in text editor with syntax detection
- **Resizable Layout**: Adjust panel sizes to your preference

## Architecture

Web-term authenticates by establishing SSH connections to localhost, providing:

- **Security**: OpenSSH handles authentication (same as SSH login)
- **No Privileges**: No root access or sudo configuration needed
- **User Context**: All operations run as the authenticated user
- **Battle-tested**: Relies on standard SSH infrastructure

## Requirements

- Node.js 16+
- SSH server running on localhost (typically pre-installed)
- SSH password authentication enabled (default on most systems)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd web-term
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.default .env
   ```

   Edit `.env` to customize settings:
   ```bash
   PORT=3000
   NODE_ENV=development
   ```

4. **Verify SSH is running:**
   ```bash
   sudo systemctl status sshd
   # or on Ubuntu/Debian
   sudo systemctl status ssh
   ```

## Usage

### Development Mode

Start the server with auto-reload:

```bash
npm run dev
```

### Production Mode

Start the server:

```bash
npm start
```

Then open your browser to `http://localhost:3000` (or the PORT you configured).

### Systemd User Service

To run web-term as a systemd user service:

1. **Copy service file:**
   ```bash
   mkdir -p ~/.config/systemd/user
   cp web-term.service ~/.config/systemd/user/
   ```

2. **Edit service file** to update paths if needed:
   ```bash
   nano ~/.config/systemd/user/web-term.service
   ```

3. **Enable and start:**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable web-term.service
   systemctl --user start web-term.service
   ```

4. **Check status:**
   ```bash
   systemctl --user status web-term.service
   ```

5. **View logs:**
   ```bash
   journalctl --user -u web-term.service -f
   ```

## Reverse Proxy Setup

For production, use a reverse proxy like nginx or caddy for HTTPS:

### Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name terminal.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy Example

```
terminal.example.com {
    reverse_proxy localhost:3000
}
```

## Technology Stack

- **Backend**: Node.js, Express, ssh2, ws
- **Frontend**: Vanilla JavaScript, xterm.js
- **Authentication**: SSH to localhost
- **File Operations**: SFTP over SSH
- **UI**: Modern dark theme CSS

## Project Structure

```
web-term/
├── src/
│   ├── server/          # Backend code
│   │   ├── app.js       # Express + WebSocket server
│   │   ├── auth.js      # SSH authentication
│   │   ├── terminal.js  # Terminal session management
│   │   ├── filebrowser.js # SFTP file operations
│   │   └── websocket.js # WebSocket message routing
│   └── client/          # Frontend code
│       ├── app.js       # Main application
│       ├── auth.js      # Login/logout UI
│       ├── terminal.js  # Terminal component
│       ├── filebrowser.js # File browser component
│       └── editor.js    # File editor
├── public/
│   ├── index.html       # Single page app
│   └── css/
│       └── styles.css   # Dark theme styles
└── .env                 # Configuration (copy from .env.default)
```

## Security Notes

- Runs without root privileges
- Uses SSH for authentication (same security as SSH login)
- All file operations respect Linux file permissions
- Sessions are isolated per user
- Recommend using HTTPS in production (via reverse proxy)

## Troubleshooting

### Cannot authenticate

- Ensure SSH server is running: `sudo systemctl status sshd`
- Verify password authentication is enabled in `/etc/ssh/sshd_config`
- Check that your user account has a valid password

### Connection refused

- Check that the app is running: `systemctl --user status web-term`
- Verify PORT configuration in `.env`
- Check firewall settings

### Terminal not displaying

- Clear browser cache and reload
- Check browser console for errors
- Verify xterm.js CDN is accessible

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.
