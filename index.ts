#!/usr/bin/env node

import { spawn } from 'child_process';
import { WebSocket, WebSocketServer } from 'ws';
import * as path from 'path';
import * as chalk from 'chalk';

// IMP: Allow users to specify ports via command line arguments.
const PORT_WS = 4000;
const PORT_UI = 3000;
const wss = new WebSocketServer({ port: PORT_WS });

let clients = [];

console.log(chalk.bold.blue('\n========================================'));
console.log(chalk.bold.blue('       NGRX DEVTOOLS SERVER'));
console.log(chalk.bold.blue('========================================\n'));

wss.on('connection', (socket) => {
  clients.push(socket);
  socket.on('message', (message) => {
    clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});
const ui = spawn(
  'npx',
  ['serve', '-s', path.join(__dirname, 'ngrx-devtool-ui/browser')],
  {
    shell: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  }
);
ui.on('error', (error) => {
  console.error('Failed to start UI server: ', error);
});
console.log(chalk.magenta('Starting UI server... '));
process.on('SIGINT', () => {
  ui.kill();
  wss.close();
  process.exit(0);
});

console.log(
  chalk.green(`\n✓ WebSocket server running on ws://localhost:${PORT_WS}`)
);
console.log(chalk.green(`✓ UI server running on http://localhost:${PORT_UI}`));
console.log(chalk.blue('\nPress Ctrl+C to stop all servers'));
