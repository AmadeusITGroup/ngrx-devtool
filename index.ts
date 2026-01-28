#!/usr/bin/env node
// This is a script which runs a local websocket server, and spawn the ngrx-devtool ui.
// thus allowing the library to communicate with the UI via the websocket server.
import { spawn } from 'child_process';
import { WebSocket, WebSocketServer } from 'ws';
import * as path from 'path';
const chalk = require('chalk');

// IMP: Allow users to specify ports via command line arguments.
const PORT_WS = 4000;
const PORT_UI = '3000';
const wss = new WebSocketServer({ port: PORT_WS });

let clients = [];

const logo = `
                                    ***@  +**
                                  **         ******%
                               @**   .......-::       ++%
                         #****%    ...................    *+
                       **          . .....................   +
                      #*....         .............:--=- :.     =
                      # .          ...............:-%*%% %.      =
                     **           ..................*. *-+@.      =
                  %***           .......... ** ......    .......   +
                *#              ....:::#********# ....  .. ....    =:
               * ..           ...:::****+=@@@@@@@@@@@  .......    #=
              %* ..:.       ...:: +*+.@@@@@@@@@@@@@@@@@@@@%###%%###*+
               # ...      ...:::++=@@@@@@@@%%%%%%%%@@@@@@@@@#%%-## **     =
               *# .      ..:::*++@@@@@@%%%%%%##%%%%%%%%@@@@@@@+###+:** ..
               **       ..:::=+-@@@@@%%%           ##%%%%@@@@@@*.#@%+# ##..
              %*       ..:::*=%@@@@%%%%%             ##%%%%%%@@@@+%%%%%*# #. *
             *#       ..:::.=@@@@@%%%%%%########*     ####%%%%@@@@%*%## ##  .
             *        .::::+.@@@@%%%%%%%%%%%#####*    @*###%%%%@%@#%%#%-@% #.
             *  .     :::::=@@%%%%%%%%%%#####%@=       *####%%%%%%*### .%##%.
             * ..     .::::=@@%%%%%%####               *####%%%%%%%##   %-# .
             :*       ..:::-@@%%%%####*     @###*#     *####%%%%%%#*    ## -:
             ..*#*     .:::-%@%%%%####     ######*     *#####%%*##@    @# .:=*
              =+ +    =..:::%@%%%%####     ######*     *#####%%#*  ..    ..:@+
              %+ -=    +..-: %%%%%####.                ####%%%% =..    ... @#*
               *+ =   . + .--%%%%%%####*         %     ##%%%#-....    ... # *-
               @*:++   : += -:%%%#######******#########%%%%%%%%%%%# =.    #*:*
                ** **   : ++ =:%%%%##*********####%%%%%%%%%%%%%%@ :::...** :**
                 ** ** . . .== . ### ++++++***####%%%%%%%%%%+  --:::: #* ::@#-
                . ** ##       === %**   .::-++*###%% :.+-:::::::::@*% =---##%
                 . ** *#@        =--==       :=**#%%%%%  :..:....::.====-%**:.
                     +#@##           *-:        %*###%%%###-  :::==++==@%#%..
                     +**:*##           .         .......:::::+===++==%%##.:.
                    .  **#=####             ....:::--------==.-===+%%%#%::.
                    . .  **#++####      .....:.::::::::-:::-====%%%*#%-:-:
                      ...  *##-+#####@ .. .::::::.   .:::---%%%%#*#%---::
                        ..:. **###*######%%@  .. ... @#%%%%%%#*#%.--=::
                          ....  **##%=*####%%%%%%%%%%%#%****## ---:::
                             ..... .*****%#%#=+***--####%=-:-:-:::
                                        ::::====---- ===--=::::
                                      . .:.:::-:::--:::::::
                                         .........:
`;

console.log(chalk.magenta(logo));
console.log(chalk.dim('─'.repeat(60)));
console.log(chalk.bold.white('  NgRx DevTools Server'));
console.log(chalk.dim('─'.repeat(60)));

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
  ['http-server', path.resolve(__dirname, 'ngrx-devtool-ui/browser'), '-p', PORT_UI, '-c-1'],
  {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

ui.stdout?.on('data', (data) => {
  // Suppress http-server verbose output
});

ui.stderr?.on('data', (data) => {
  const msg = data.toString().trim();
  // Only show actual errors, not deprecation warnings
  if (msg && !msg.includes('DeprecationWarning')) {
    console.error(chalk.red(`  ✗ UI Error: ${msg}`));
  }
});

ui.on('error', (error) => {
  console.error(chalk.red('  ✗ Failed to start UI server:', error.message));
});
process.on('SIGINT', () => {
  console.log(chalk.dim('\n\n  Shutting down servers...'));
  ui.kill();
  wss.close();
  console.log(chalk.green('  ✓ Servers stopped. Goodbye!\n'));
  process.exit(0);
});

console.log('');
console.log(chalk.green(`  ✓ WebSocket`), chalk.dim(`ws://localhost:${PORT_WS}`));
console.log(chalk.green(`  ✓ UI Server`), chalk.dim(`http://localhost:${PORT_UI}`));
console.log('');
console.log(chalk.dim('─'.repeat(60)));
console.log(chalk.dim('  Press'), chalk.white('Ctrl+C'), chalk.dim('to stop all servers'));
console.log(chalk.dim('─'.repeat(60)));
console.log('');
