# OAuth Integration Options for Web-Term

This document outlines architectural choices for migrating from password-based SSH authentication to OAuth (Azure AD/Microsoft Entra) authentication.

## Current Architecture

```
User (browser) → Password → SSH to localhost:22 → Shell session
                                                → SFTP for file ops
                                                → tmux for persistence
```

**Benefits of current approach:**
- Web terminal and regular SSH clients get identical environments
- Full PAM stack is used (consistent with organizational policies)
- SSH daemon handles all security, session management
- SFTP provides secure file operations
- tmux sessions persist across disconnects

## The OAuth Challenge

With OAuth/Azure AD authentication:
- User authenticates via Microsoft identity provider
- Server receives an OAuth token, **not** a Linux password
- Cannot SSH with a token - SSH requires password or key

## Option 1: Temporary SSH Keys

Generate ephemeral SSH keys on OAuth login, use them to SSH as the user.

### Flow
```
1. User authenticates via OAuth → Server gets token + username
2. Server generates temporary RSA/ED25519 keypair
3. Server appends public key to user's ~/.ssh/authorized_keys
4. Server SSHs to localhost using private key (as that user)
5. On logout, remove the public key from authorized_keys
```

### Implementation
```javascript
// Pseudocode
async function oauthLogin(oauthToken) {
  const username = validateTokenAndGetUsername(oauthToken);

  // Generate temporary keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  // Add to authorized_keys (needs privileged helper or sudo)
  await appendToAuthorizedKeys(username, publicKey);

  // SSH using the private key
  const conn = new ssh2.Client();
  conn.connect({
    host: 'localhost',
    username,
    privateKey
  });

  // Store privateKey in session for reconnects
  // Remove publicKey from authorized_keys on logout
}
```

### Pros
- **100% consistency** with regular SSH sessions
- Full PAM stack executes (organizational policies enforced)
- SSH agent, environment variables, all SSH features work
- Minimal code changes - just swap password for key
- SFTP continues to work unchanged
- tmux integration unchanged

### Cons
- Requires write access to user's `~/.ssh/authorized_keys`
- Need privileged helper process or sudo rules
- Key management complexity (cleanup on crash, expiry)
- Small window where temp key exists (security consideration)
- Must ensure `authorized_keys` permissions stay correct

### Security Considerations
- Use short-lived keys with `expiry-time` option if OpenSSH 9.5+
- Restrict key with `from="127.0.0.1"` to only allow localhost
- Consider `command=` restriction if appropriate
- Store private keys only in memory, never on disk
- Implement cleanup on server crash (cron job to remove stale keys)

---

## Option 2: node-pty with su/sudo

Replace SSH entirely with local PTY spawning using node-pty.

### Flow
```
1. User authenticates via OAuth → Server gets token + username
2. Server spawns shell via node-pty: `su - ${username}` or `sudo -u ${username} -i`
3. File operations via Node.js fs with proper uid/gid
4. tmux via `sudo -u ${username} tmux ...`
```

### Implementation
```javascript
const pty = require('node-pty');

function createTerminal(username) {
  return pty.spawn('su', ['-', username], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: `/home/${username}`,
    env: process.env
  });
}

// Or with sudo
function createTerminal(username) {
  return pty.spawn('sudo', ['-u', username, '-i'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24
  });
}
```

### Pros
- No SSH dependency - simpler architecture
- No key management needed
- Direct process spawning is faster than SSH
- Works even if SSH server is down
- Easier to debug (local processes)

### Cons
- **Different environment** than SSH sessions:
  - No SSH PAM modules execute
  - No `SSH_CLIENT`, `SSH_CONNECTION`, `SSH_TTY` variables
  - No `~/.ssh/environment` sourced
  - No SSH agent forwarding
- Server must run as root (or have extensive sudo rules)
- File operations need careful uid/gid handling
- `su -` gives login shell but not identical to SSH login shell
- Security: root-running server is higher risk
- SFTP replacement needed (Node.js fs operations)

### Environment Differences

| Aspect | SSH | su - / sudo -i |
|--------|-----|----------------|
| PAM modules | sshd PAM stack | su/sudo PAM stack |
| Login shell | Yes | Yes |
| .profile sourced | Yes | Yes |
| .bashrc sourced | Yes (if .profile sources it) | Yes (if .profile sources it) |
| SSH_* env vars | Set | Not set |
| SSH agent | Available | Not available |
| ~/.ssh/environment | Sourced | Not sourced |

---

## Option 3: PAM OAuth Module

Configure PAM to accept OAuth tokens directly for SSH authentication.

### Flow
```
1. User authenticates via OAuth in browser → Gets token
2. Token passed to SSH as "password"
3. Custom PAM module validates token with Azure AD
4. SSH session established normally
```

### Implementation
- Install/configure `pam_oauth2` or similar module
- Configure `/etc/pam.d/sshd` to use OAuth validation
- SSH password field contains the OAuth token

### Pros
- SSH architecture completely unchanged
- 100% environment consistency
- No key management
- Standard PAM integration

### Cons
- Complex PAM configuration
- Requires PAM module installation (system-level change)
- Token lifetime issues (SSH sessions can outlive tokens)
- Not all PAM OAuth modules are production-ready
- Requires coordination with system administrators
- May conflict with existing PAM policies

---

## Option 4: Container Per User

Spin up an isolated container for each authenticated user.

### Flow
```
1. User authenticates via OAuth
2. Server spawns Docker/Podman container for user
3. User's home directory mounted into container
4. Terminal connects to container shell
5. Container destroyed on logout
```

### Implementation
```javascript
const { Docker } = require('dockerode');

async function createUserSession(username) {
  const docker = new Docker();

  const container = await docker.createContainer({
    Image: 'webterm-user-shell',
    User: username,
    Cmd: ['/bin/bash', '-l'],
    Tty: true,
    OpenStdin: true,
    HostConfig: {
      Binds: [`/home/${username}:/home/${username}`],
      NetworkMode: 'host'
    }
  });

  await container.start();
  return container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
}
```

### Pros
- Strong isolation between users
- Can provide consistent environment regardless of host
- Easy to add tooling (pre-installed in container image)
- No need for user accounts on host (just mount home dir)
- Container can have exactly the environment you want

### Cons
- Significant architectural change
- Container overhead (startup time, resources)
- Complexity in managing container lifecycle
- File permissions can be tricky with mounts
- tmux state doesn't persist if container restarts
- Requires Docker/Podman infrastructure
- Different environment than direct SSH to host

---

## Recommendation

### For Maximum Consistency: Option 1 (Temporary SSH Keys)

If maintaining identical environments between web terminal and regular SSH is critical, use temporary SSH keys. This preserves the entire SSH/PAM stack with minimal changes.

**Implementation priority:**
1. Create privileged helper script for authorized_keys management
2. Add key generation on OAuth login
3. Modify SSH connection to use key instead of password
4. Implement key cleanup on logout and server shutdown
5. Add cron job to clean orphaned keys

### For Simplicity: Option 2 (node-pty)

If environment consistency is less critical and you want to eliminate SSH dependency, use node-pty. This is simpler but users will notice differences if they compare web terminal to SSH.

**When to choose this:**
- SSH-specific PAM modules aren't important
- Users don't rely on SSH agent forwarding
- Simpler deployment is preferred
- Server already runs with elevated privileges

---

## Migration Path

### Phase 1: Prepare (Current)
- Document current SSH/PAM configuration
- Identify SSH-specific features in use
- Audit what environment variables users depend on

### Phase 2: Implement OAuth
- Set up Azure AD app registration
- Implement OAuth flow in web-term
- Keep password-based SSH as fallback

### Phase 3: Add Keyless SSH (Option 1) or node-pty (Option 2)
- Implement chosen approach
- Test environment consistency
- Run both in parallel initially

### Phase 4: Deprecate Password Auth
- Remove password-based login from web UI
- Keep SSH password auth for direct SSH clients (or disable if not needed)

---

## Questions to Answer Before Deciding

1. **Do users rely on SSH agent forwarding?** If yes, Option 1 only.

2. **Are there SSH-specific PAM modules?** (e.g., pam_access rules for SSH, audit logging)
   If yes, Option 1 preserves these.

3. **Can the server run as root?** Option 2 requires this.

4. **Do Linux usernames match Azure AD usernames?** All options require some username mapping.

5. **Is container infrastructure available?** If yes, Option 4 becomes viable.

6. **How important is environment consistency?** If critical, Option 1. If flexible, Option 2.

---

## References

- [OpenSSH authorized_keys format](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT)
- [node-pty documentation](https://github.com/microsoft/node-pty)
- [PAM configuration](https://linux.die.net/man/5/pam.conf)
- [Azure AD OAuth 2.0](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
