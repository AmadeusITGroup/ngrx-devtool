import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 4000 });

let clients = [];
wss.on('listening', () => {
  console.log('WebSocket server is listening on ws://localhost:4000');
});
wss.on('connection', (socket) => {
  clients.push(socket);
  socket.on('message', (message) => {
    console.log("Received message", message)
    clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});
