import { ActionReducer, Action } from '@ngrx/store';
import { inject } from '@angular/core';
import { PerformanceTrackerService } from './performance-tracker.service';

export interface RenderPerformanceData {
  /** Time for Angular to render components (ms) */
  renderTime: number;
}

export interface StateChangeMessage {
  type: 'STATE_CHANGE';
  action: Action;
  prevState: any;
  nextState: any;
  timestamp: string;
  renderPerformance?: RenderPerformanceData;
}

/**
 * Configuration options for the DevTool meta-reducer.
 */
export interface DevToolMetaReducerConfig {
  wsUrl?: string;
  enablePerformanceTracking?: boolean;
}

/**
 * Create a meta-reducer factory with configurable WebSocket URL.
 */
export function createDevToolMetaReducer(
  wsUrlOrConfig: string | DevToolMetaReducerConfig = 'ws://localhost:4000'
) {
  const config: DevToolMetaReducerConfig = typeof wsUrlOrConfig === 'string'
    ? { wsUrl: wsUrlOrConfig }
    : wsUrlOrConfig;

  const wsUrl = config.wsUrl ?? 'ws://localhost:4000';
  const enablePerf = config.enablePerformanceTracking ?? true;

  // Only create WebSocket in browser environment
  const isBrowser = typeof window !== 'undefined' && typeof WebSocket !== 'undefined';
  const socket = isBrowser ? new WebSocket(wsUrl) : null;
  const messageBuffer: string[] = [];

  function flushBuffer() {
    while (messageBuffer.length > 0 && socket?.readyState === WebSocket.OPEN) {
      const message = messageBuffer.shift();
      if (message && socket) {
        socket.send(message);
      }
    }
  }

  if (socket) {
    socket.onopen = flushBuffer;
  }

  return function devToolMetaReducer<State>(
    reducer: ActionReducer<State>
  ): ActionReducer<State> {
    // Get performance tracker via dependency injection
    const performanceTracker = inject(PerformanceTrackerService);

    return function (state, action) {
      const prevState = state;

      // Send initial message without render performance
      const initialMessage: StateChangeMessage = {
        type: 'STATE_CHANGE',
        action,
        prevState,
        nextState: null as any, // Will be set below
        timestamp: new Date().toISOString(),
      };

      let nextState: State;

      if (enablePerf) {
        // Measure render time and send updated message when complete
        nextState = performanceTracker.measureRenderTime(
          action.type,
          () => reducer(state, action),
          (renderTime) => {
            console.log(`[Meta-Reducer] Render complete for ${action.type}: ${renderTime}ms`);
            // Send updated message with render performance
            const perfMessage: StateChangeMessage = {
              ...initialMessage,
              nextState,
              renderPerformance: {
                renderTime
              }
            };

            const payload = JSON.stringify(perfMessage);
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(payload);
            } else {
              console.warn('[Meta-Reducer] WebSocket not open, cannot send render performance');
            }
          }
        );
      } else {
        nextState = reducer(state, action);
      }

      // Send initial message immediately
      initialMessage.nextState = nextState;
      const payload = JSON.stringify(initialMessage);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else if (isBrowser) {
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
