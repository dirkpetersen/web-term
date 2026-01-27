# Setup and Deployment Guide

## Prerequisites

- **Linux/Unix System**: Ubuntu, Debian, CentOS, macOS, or similar
- **Node.js**: v14+ (v16+ recommended)
- **npm**: Bundled with Node.js
- **OpenSSH Server**: Running and accepting password authentication
- **Port 3000**: Available (or configure different port via .env)

## Installation

### 1. Clone or Download
```bash
cd ~/projects
git clone <repository-url> web-term
cd web-term
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- `express`: HTTP server framework
- `ws`: WebSocket server
- `ssh2`: SSH client library
- `uuid`: Session ID generation
- `dotenv`: Environment variable loading

### 3. Configure Environment
```bash
cp .env.default .env
```

Edit `.env`:
```env
PORT=3000
NODE_ENV=development
```

### 4. Verify SSH Server
```bash
# Check if SSH is running
sudo systemctl status ssh
# or on some systems
sudo systemctl status sshd

# If not running, start it
sudo systemctl start ssh
# or
sudo systemctl start sshd

# Enable on boot (optional)
sudo systemctl enable ssh
```

### 5. Start the Server

**Development** (with auto-reload):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

You should see:
```
Web Terminal Server running on http://localhost:3000
Waiting for connections...
```

### 6. Access the App
Open browser: http://localhost:3000

Log in with your Linux username and password.

---

## Production Deployment

### Using systemd User Service

Create `~/.config/systemd/user/web-term.service`:
```ini
[Unit]
Description=Web Terminal Service
After=network.target

[Service]
Type=simple
User=%U
WorkingDirectory=/home/USERNAME/projects/web-term
ExecStart=/usr/bin/node /home/USERNAME/projects/web-term/src/server/app.js
Restart=on-failure
RestartSec=5

Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=default.target
```

Replace `USERNAME` with actual username.

**Start the service**:
```bash
# Reload systemd
systemctl --user daemon-reload

# Enable auto-start
systemctl --user enable web-term.service

# Start service
systemctl --user start web-term.service

# Check status
systemctl --user status web-term.service

# View logs
journalctl --user -u web-term.service -f
```

### Using Reverse Proxy (HTTPS)

web-term should not be exposed directly to the internet. Use nginx or Caddy as a reverse proxy for HTTPS.

#### nginx Example
```nginx
server {
    listen 443 ssl http2;
    server_name terminal.example.com;

    ssl_certificate /etc/letsencrypt/live/terminal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/terminal.example.com/privkey.pem;

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

#### Caddy Example
```caddy
terminal.example.com {
    reverse_proxy localhost:3000
}
```

Then use `wss://` in production instead of `ws://`.

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server/app.js"]
```

Build and run:
```bash
docker build -t web-term .
docker run -p 3000:3000 --net host web-term
```

Note: `--net host` allows container to access localhost:22 (SSH server).

---

## Configuration

### Environment Variables (.env)

```env
PORT=3000              # Server port
NODE_ENV=production    # development or production
```

### Port Selection

- **Default**: 3000
- **Change**: Edit `.env` and set `PORT=8080` (or any available port)
- **System Ports** (< 1024): Require sudo, not recommended

### Resource Limits

For production, consider:
- **File Upload Limit**: 100MB (configured in Express middleware)
- **Terminal Buffer**: Unlimited (handled by xterm.js client-side)
- **Concurrent Users**: Limited by system resources (each uses SSH connection)
- **Session Storage**: In-memory (not persisted across restarts)

---

## Troubleshooting

### "connect ECONNREFUSED 127.0.0.1:22"
**Problem**: SSH server not running on localhost:22

**Solution**:
```bash
# Start SSH
sudo systemctl start ssh

# Or verify it's listening
netstat -tlnp | grep :22
# or
ss -tlnp | grep :22
```

### "Authentication failed"
**Problem**: Username or password incorrect

**Solution**:
- Verify credentials with `ssh localhost` from command line
- Check if user account exists: `id username`
- Verify SSH allows password auth in `/etc/ssh/sshd_config`:
  ```
  PasswordAuthentication yes
  ```

### Port Already in Use
**Problem**: "Error: listen EADDRINUSE :::3000"

**Solution**:
```bash
# Find process using port
lsof -i :3000
# or
ss -tlnp | grep :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=8080 npm start
```

### WebSocket Connection Failed
**Problem**: "WebSocket connection failed"

**Solution**:
- Check browser console (F12 → Console)
- Verify sessionId is valid in localStorage
- Restart server
- Check reverse proxy WebSocket upgrade headers (if using proxy)

### File Operations Not Working
**Problem**: "Failed to read file" or similar

**Solution**:
- Check user permissions: `ls -la /home/username`
- Verify SFTP works manually:
  ```bash
  sftp username@localhost
  ```
- Check file path (may need full absolute path)
- Review server logs: `journalctl --user -u web-term.service -f`

---

## Performance Tuning

### Node.js Heap Size
For heavy usage, increase Node memory:
```bash
NODE_OPTIONS="--max_old_space_size=2048" npm start
```

### SSH Connection Pooling
Currently: 1 SFTP connection per user session (already optimized)

### Terminal Performance
If experiencing lag:
- Close unused terminals
- Reduce font size (uses less rendering)
- Use smaller terminal windows

---

## Logging

### Development
Logs output to console:
```bash
npm run dev
```

### Production with systemd
View logs:
```bash
journalctl --user -u web-term.service -f
```

### Server Code Logging
Add to `src/server/app.js`:
```javascript
console.log('Download request:', { sessionId, filePath });
console.error('Error:', err);
```

### Client Logging
Browser console (F12):
```javascript
console.log('WebSocket connected');
console.error('File error:', err);
```

---

## Updates and Maintenance

### Backup
```bash
tar -czf web-term-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.env \
  --exclude=public/favicon.png \
  ~/projects/web-term
```

### Update Dependencies
```bash
npm update
npm audit fix
npm test  # If tests exist
```

### Restart Service
```bash
systemctl --user restart web-term.service
```

### Monitor Uptime
```bash
systemctl --user status web-term.service
journalctl --user -u web-term.service --since "1 hour ago"
```

---

## Security Hardening

### 1. Use HTTPS
Mandatory in production. Use reverse proxy (nginx/Caddy) with Let's Encrypt SSL certificates.

### 2. Firewall
```bash
# Allow only necessary ports
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 22/tcp   # SSH (for admin only)
sudo ufw deny 3000/tcp  # Block direct access
```

### 3. SSH Configuration
Edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication yes      # Required for web-term
PubkeyAuthentication yes
PermitRootLogin no
```

Then restart: `sudo systemctl restart ssh`

### 4. Rate Limiting
Add to reverse proxy (nginx example):
```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

location /api/login {
    limit_req zone=login burst=10 nodelay;
    proxy_pass http://localhost:3000;
}
```

### 5. Session Timeout
Currently: No automatic session timeout. Consider adding:
```javascript
// In websocket.js
const SESSION_TIMEOUT = 1000 * 60 * 30; // 30 minutes
```

### 6. Monitor Access
```bash
tail -f /var/log/auth.log  # SSH login attempts
journalctl --user -u web-term.service -f  # App logs
```

