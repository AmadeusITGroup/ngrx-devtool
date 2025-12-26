import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Subject, takeUntil, tap } from 'rxjs';
import { EffectTrackerService, TrackedAction } from './effect-tracker.service';
import { EffectEvent } from './devtools-effect-sources';

export interface DevToolMessage {
  type: 'ACTION_TRACKED' | 'EFFECT_CHAIN' | 'EFFECT_EVENT' | 'TIMELINE_CLEARED';
  action?: string;
  payload?: any;
  isEffectResult?: boolean;
  effectName?: string;
  correlation?: {
    id: string;
    triggeredBy?: string;
  };
  effectEvent?: {
    name: string;
    lifecycle: string;
    duration?: number;
    executionId?: string;
    dispatch?: boolean;
  };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ActionsInterceptorService implements OnDestroy {
  private readonly actions$ = inject(Actions);
  private readonly effectTracker = inject(EffectTrackerService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private destroy$ = new Subject<void>();
  private socket: WebSocket | null = null;
  private messageBuffer: string[] = [];
  private isConnected = false;

  /**
   * Initialize the interceptor with WebSocket connection.
   * Call this once during app initialization.
   */
  initialize(wsUrl: string = 'ws://localhost:4000'): void {
    this.setupWebSocket(wsUrl);
    this.setupActionInterception();
    this.setupEffectEventForwarding();
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
    // Only create WebSocket in browser environment
    if (!this.isBrowser) {
      console.log('[NgRx DevTool] Skipping WebSocket setup (not in browser)');
      return;
    }

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
          effectName: tracked.effectName,
          correlation: tracked.correlationId
            ? { id: tracked.correlationId }
            : undefined,
          timestamp: new Date().toISOString(),
        };

        this.sendMessage(message);
      })
    ).subscribe();
  }

  /**
   * Forward effect lifecycle events to WebSocket.
   * This provides real-time effect tracking to the DevTools UI.
   */
  private setupEffectEventForwarding(): void {
    console.log('[NgRx DevTool] Setting up effect event forwarding');

    this.effectTracker.effectEvents$.pipe(
      takeUntil(this.destroy$),
      tap((event: EffectEvent) => {
        console.log('[NgRx DevTool] Forwarding effect event:', event.effectName, event.lifecycle);

        const message: DevToolMessage = {
          type: 'EFFECT_EVENT',
          action: event.action?.type,
          effectName: event.effectName,
          effectEvent: {
            name: event.effectName,
            lifecycle: event.lifecycle,
            duration: event.duration,
            executionId: event.executionId,
            dispatch: event.dispatch,
          },
          timestamp: new Date().toISOString(),
        };

        this.sendMessage(message);
      })
    ).subscribe({
      error: (err) => console.error('[NgRx DevTool] Effect event forwarding error:', err)
    });
  }

  private sendMessage(message: DevToolMessage): void {
    const payload = JSON.stringify(message);

    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      console.log('[NgRx DevTool] Sending message:', message.type, message.effectName || message.action || '');
      this.socket.send(payload);
    } else {
      console.log('[NgRx DevTool] Buffering message (socket not ready):', message.type);
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
