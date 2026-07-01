const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, 'dist', 'index.js');

try {
  fs.chmodSync(cliPath, 0o755);
} catch (error) {
  if (process.platform !== 'win32') {
    throw error;
  }
}
