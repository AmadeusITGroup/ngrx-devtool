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
// These patterns identify actions that are RESULTS of effects (dispatched by effects)
const EFFECT_RESULT_PATTERNS = [
  // API response patterns
  /\[.*API.*\]/i,           // [Books API], [Users API], etc.
  /\[.*Service.*\]/i,       // [Auth Service], etc.
  /\[.*Effect.*\]/i,        // [Router Effect], etc.

  // Arrow notation (common in enterprise apps)
  /-> Succeeded/i,          // [Competitors API] Fetch -> Succeeded
  /-> Failed/i,             // [Competitors API] Fetch -> Failed
  /-> Success/i,            // [API] Action -> Success
  /-> Failure/i,            // [API] Action -> Failure
  /-> Error/i,              // [API] Action -> Error
  /-> Complete/i,           // [API] Action -> Complete
  /-> Loaded/i,             // [API] Action -> Loaded

  // Suffix patterns (camelCase and separate words)
  /Success$/i,              // loadBooksSuccess, Load Books Success
  /Succeeded$/i,            // fetchCompetitorsSucceeded
  /Failure$/i,              // loadBooksFailure
  /Failed$/i,               // fetchCompetitorsFailed
  /Error$/i,                // loadBooksError
  /Complete$/i,             // loadBooksComplete
  /Completed$/i,            // loadBooksCompleted
  /Retrieved/i,             // retrievedBookList, Retrieved Book List
  /Loaded$/i,               // booksLoaded, Books Loaded
  /Fetched$/i,              // booksFetched, Books Fetched
  /Received$/i,             // dataReceived
  /Updated$/i,              // stateUpdated (when from API)
  /Created$/i,              // itemCreated (when from API)
  /Deleted$/i,              // itemDeleted (when from API)
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
    return EFFECT_RESULT_PATTERNS.some(pattern => pattern.test(actionType));
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
  console.log('[NgRx DevTool] Meta-reducer initialized - Version: 2025-12-09');
  return createDevToolMetaReducer('ws://localhost:4000')(reducer);
}
