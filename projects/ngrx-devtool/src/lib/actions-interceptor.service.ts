import { Injectable, OnDestroy } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Subject, takeUntil, tap } from 'rxjs';
import { EffectTrackerService, TrackedAction } from './effect-tracker.service';

export interface DevToolMessage {
  type: 'ACTION_TRACKED' | 'EFFECT_CHAIN' | 'TIMELINE_CLEARED';
  action?: string;
  payload?: any;
  isEffectResult?: boolean;
  correlation?: {
    id: string;
    triggeredBy?: string;
  };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ActionsInterceptorService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private socket: WebSocket | null = null;
  private messageBuffer: string[] = [];
  private isConnected = false;

  constructor(
    private actions$: Actions,
    private effectTracker: EffectTrackerService
  ) {}

  /**
   * Initialize the interceptor with WebSocket connection.
   * Call this once during app initialization.
   */
  initialize(wsUrl: string = 'ws://localhost:4000'): void {
    this.setupWebSocket(wsUrl);
    this.setupActionInterception();
  }

  /**
   * Register action types that are dispatched by effects.
   * This improves tracking accuracy.
   */
  registerEffectActions(actionTypes: string[]): void {
    this.effectTracker.registerEffectActionTypes(actionTypes);
  }

  /**
   * Get the current action timeline.
   */
  getTimeline(): TrackedAction[] {
    return this.effectTracker.getTimeline();
  }

  /**
   * Clear the action timeline.
   */
  clearTimeline(): void {
    this.effectTracker.clearTimeline();
    this.sendMessage({
      type: 'TIMELINE_CLEARED',
      timestamp: new Date().toISOString(),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socket?.close();
  }

  private setupWebSocket(wsUrl: string): void {
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.flushBuffer();
    };

    this.socket.onclose = () => {
      this.isConnected = false;
    };

    this.socket.onerror = (error) => {
      console.warn('[NgRx DevTool] WebSocket error:', error);
    };
  }

  private setupActionInterception(): void {
    this.actions$.pipe(
      takeUntil(this.destroy$),
      tap((action: Action) => {
        const tracked = this.effectTracker.trackAction(action);

        const message: DevToolMessage = {
          type: 'ACTION_TRACKED',
          action: action.type,
          payload: this.sanitizePayload(action),
          isEffectResult: tracked.source === 'effect',
          correlation: tracked.correlationId
            ? { id: tracked.correlationId }
            : undefined,
          timestamp: new Date().toISOString(),
        };

        this.sendMessage(message);
      })
    ).subscribe();
  }

  private sendMessage(message: DevToolMessage): void {
    const payload = JSON.stringify(message);

    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    } else {
      this.messageBuffer.push(payload);
    }
  }

  private flushBuffer(): void {
    while (this.messageBuffer.length > 0 && this.isConnected) {
      const message = this.messageBuffer.shift();
      if (message && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(message);
      }
    }
  }

  private sanitizePayload(action: Action): any {
    try {
      // Attempt to serialize to catch circular references
      JSON.stringify(action);
      return action;
    } catch {
      return {
        type: action.type,
        _note: 'Payload contained non-serializable data',
      };
    }
  }
}
