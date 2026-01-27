const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection successful!');
  conn.end();
  process.exit(0);
});

conn.on('error', (err) => {
  console.error('SSH connection failed:', err.message);
  process.exit(1);
});

// Try to connect
console.log('Attempting SSH connection to localhost:22...');
conn.connect({
  host: 'localhost',
  port: 22,
  username: 'jimmy',
  password: 'test'  // Won't work but should show different error
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);
