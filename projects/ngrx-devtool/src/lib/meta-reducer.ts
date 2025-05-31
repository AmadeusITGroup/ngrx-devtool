import { ActionReducer } from '@ngrx/store';

const socket = new WebSocket('ws://localhost:4000');
const messageBuffer: string[] = [];

function flushBuffer() {
  while (messageBuffer.length > 0 && socket.readyState === WebSocket.OPEN) {
    const message = messageBuffer.shift();
    if (message) {
      socket.send(message);
    }
  }
}

socket.addEventListener('open', flushBuffer);

export function loggerMetaReducer<State>(
  reducer: ActionReducer<State>
): ActionReducer<State> {
  return function (state, action) {
    const prevState = state;
    const nextState = reducer(state, action);
    const payload = JSON.stringify({
      type: action.type,
      prevState,
      nextState,
      timestamp: new Date().toISOString(),
    });
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    } else {
      messageBuffer.push(payload)
    }
    return nextState;
  };
}
