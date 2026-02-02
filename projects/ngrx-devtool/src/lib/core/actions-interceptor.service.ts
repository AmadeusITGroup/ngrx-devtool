import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Subject, takeUntil, tap } from 'rxjs';
import { EffectTrackerService, TrackedAction } from './effect-tracker.service';
import { EffectEvent } from './devtools-effect-sources';

export interface DevToolMessage {
  readonly type: 'ACTION_TRACKED' | 'EFFECT_EVENT' | 'TIMELINE_CLEARED';
  readonly action?: string;
  readonly payload?: unknown;
  readonly isEffectResult?: boolean;
  readonly effectName?: string;
  readonly correlationId?: string;
  readonly effectEvent?: {
    readonly name: string;
    readonly lifecycle: string;
    readonly duration?: number;
    readonly executionId?: string;
    readonly dispatch?: boolean;
  };
  readonly timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ActionsInterceptorService implements OnDestroy {
  private readonly actions$ = inject(Actions);
  private readonly effectTracker = inject(EffectTrackerService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly destroy$ = new Subject<void>();
  private socket: WebSocket | null = null;
  private messageBuffer: string[] = [];
  private isConnected = false;
  private initialized = false;

  initialize(wsUrl = 'ws://localhost:4000'): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.setupWebSocket(wsUrl);
    this.setupActionInterception();
    this.setupEffectEventForwarding();
  }

  getTimeline(): readonly TrackedAction[] {
    return this.effectTracker.getTimeline();
  }

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
    if (!this.isBrowser) {
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

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'CLEAR_REQUEST') {
          this.effectTracker.clearTimeline();
          this.messageBuffer = [];
        }
      } catch {
        // Ignore non-JSON messages
      }
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
          correlationId: tracked.correlationId,
          timestamp: new Date().toISOString(),
        };

        this.sendMessage(message);
      })
    ).subscribe();
  }

  private setupEffectEventForwarding(): void {
    this.effectTracker.effectEvents$.pipe(
      takeUntil(this.destroy$),
      tap((event: EffectEvent) => {
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

  private sanitizePayload(action: Action): unknown {
    try {
      JSON.stringify(action);
      return action;
    } catch {
      return { type: action.type, _note: 'Non-serializable payload' };
    }
  }
}
