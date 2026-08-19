const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: npm run create-admin -- <username> <password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const SERVER_DATA_DIR = path.join(__dirname, '..', 'server-data');
const ADMIN_CREDENTIALS_PATH = path.join(SERVER_DATA_DIR, 'admin.json');

if (!fs.existsSync(SERVER_DATA_DIR)) fs.mkdirSync(SERVER_DATA_DIR);

const passwordHash = bcrypt.hashSync(password, 12);
fs.writeFileSync(ADMIN_CREDENTIALS_PATH, JSON.stringify({ username, passwordHash }, null, 2));

console.log(`Admin account created for "${username}". You can now log in at /admin/login.`);
