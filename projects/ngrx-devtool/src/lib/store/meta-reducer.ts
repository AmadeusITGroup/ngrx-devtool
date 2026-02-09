import { ActionReducer, Action } from '@ngrx/store';
import { inject } from '@angular/core';
import { PerformanceTrackerService } from '../performance/performance-tracker.service';
import { WebSocketService } from '../core/websocket.service';

export interface RenderPerformanceData {
  readonly renderTime: number;
}

export interface StateChangeMessage {
  type: 'STATE_CHANGE';
  action: Action;
  prevState: unknown;
  nextState: unknown;
  timestamp: string;
  renderPerformance?: RenderPerformanceData;
}

export interface DevToolMetaReducerConfig {
  readonly wsUrl?: string;
  readonly enablePerformanceTracking?: boolean;
}

export function createDevToolMetaReducer(
  wsUrlOrConfig: string | DevToolMetaReducerConfig = 'ws://localhost:4000'
) {
  const config: DevToolMetaReducerConfig = typeof wsUrlOrConfig === 'string'
    ? { wsUrl: wsUrlOrConfig }
    : wsUrlOrConfig;

  const wsUrl = config.wsUrl ?? 'ws://localhost:4000';
  const enablePerf = config.enablePerformanceTracking ?? true;

  return function devToolMetaReducer<State>(
    reducer: ActionReducer<State>
  ): ActionReducer<State> {
    const performanceTracker = inject(PerformanceTrackerService);
    const webSocketService = inject(WebSocketService);

    // Initialize WebSocket connection (no-op if already initialized)
    webSocketService.initialize(wsUrl);

    return function (state, action) {
      const prevState = state;
      const timestamp = new Date().toISOString();

      let nextState: State;

      if (enablePerf) {
        nextState = performanceTracker.measureRenderTime(
          action.type,
          () => reducer(state, action),
          (renderTime) => {
            const message: StateChangeMessage = {
              type: 'STATE_CHANGE',
              action,
              prevState,
              nextState,
              timestamp,
              renderPerformance: { renderTime }
            };

            webSocketService.send(message);
          }
        );
      } else {
        nextState = reducer(state, action);

        const message: StateChangeMessage = {
          type: 'STATE_CHANGE',
          action,
          prevState,
          nextState,
          timestamp,
        };

        webSocketService.send(message);
      }

      return nextState;
    };
  };
}

export function loggerMetaReducer<State>(
  reducer: ActionReducer<State>
): ActionReducer<State> {
  return createDevToolMetaReducer('ws://localhost:4000')(reducer);
}
