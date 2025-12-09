import { ActionReducer, Action } from '@ngrx/store';

export interface StateChangeMessage {
  type: 'STATE_CHANGE';
  action: Action;
  prevState: any;
  nextState: any;
  isEffectResult: boolean;
  correlation?: {
    triggeredBy: string | null;
    chainIndex: number;
  };
  timestamp: string;
}

// Effect detection patterns based on NgRx conventions
const EFFECT_ACTION_PATTERNS = [
  /\[.*API.*\]/i,
  /\[.*Service.*\]/i,
  /\[.*Effect.*\]/i,
  /Success$/i,
  /Failure$/i,
  /Error$/i,
  /Complete$/i,
  /Retrieved/i,
  /Loaded$/i,
  /Fetched$/i,
];

/**
 * Create a meta-reducer factory with configurable WebSocket URL.
 */
export function createDevToolMetaReducer(wsUrl: string = 'ws://localhost:4000') {
  const socket = new WebSocket(wsUrl);
  const messageBuffer: string[] = [];
  let lastUserAction: string | null = null;
  let actionChainIndex = 0;

  function flushBuffer() {
    while (messageBuffer.length > 0 && socket.readyState === WebSocket.OPEN) {
      const message = messageBuffer.shift();
      if (message) {
        socket.send(message);
      }
    }
  }

  socket.onopen = flushBuffer;

  function isEffectAction(actionType: string): boolean {
    return EFFECT_ACTION_PATTERNS.some(pattern => pattern.test(actionType));
  }

  return function devToolMetaReducer<State>(
    reducer: ActionReducer<State>
  ): ActionReducer<State> {
    return function (state, action) {
      const prevState = state;
      const nextState = reducer(state, action);

      const isEffect = isEffectAction(action.type);

      // Track action chain correlation
      if (!isEffect) {
        lastUserAction = action.type;
        actionChainIndex = 0;
      } else {
        actionChainIndex++;
      }

      const message: StateChangeMessage = {
        type: 'STATE_CHANGE',
        action,
        prevState,
        nextState,
        isEffectResult: isEffect,
        correlation: {
          triggeredBy: isEffect ? lastUserAction : null,
          chainIndex: actionChainIndex,
        },
        timestamp: new Date().toISOString(),
      };

      const payload = JSON.stringify(message);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else {
        messageBuffer.push(payload);
      }

      return nextState;
    };
  };
}

/**
 * Default meta-reducer with localhost WebSocket.
 * @deprecated Use createDevToolMetaReducer() for configurable setup.
 */
export function loggerMetaReducer<State>(
  reducer: ActionReducer<State>
): ActionReducer<State> {
  return createDevToolMetaReducer('ws://localhost:4000')(reducer);
}
