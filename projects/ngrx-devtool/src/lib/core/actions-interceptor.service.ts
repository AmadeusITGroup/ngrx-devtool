import { inject, Injectable, OnDestroy } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { filter, Subject, takeUntil, tap } from 'rxjs';

import { DEFAULT_WS_URL, DevToolMessage, EffectEvent, TrackedAction } from './core.models';
import { EffectTrackerService } from './effect-tracker.service';
import { WebSocketService, WebSocketMessage } from './websocket.service';

@Injectable({ providedIn: 'root' })
export class ActionsInterceptorService implements OnDestroy {
  private readonly actions$ = inject(Actions);
  private readonly effectTracker = inject(EffectTrackerService);
  private readonly webSocketService = inject(WebSocketService);

  private readonly destroy$ = new Subject<void>();
  private initialized = false;

  initialize(wsUrl = DEFAULT_WS_URL): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.webSocketService.initialize(wsUrl);
    this.setupMessageListener();
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
  }

  private setupMessageListener(): void {
    this.webSocketService.messages$.pipe(
      takeUntil(this.destroy$),
      filter((message): message is WebSocketMessage => message !== null),
      tap((message) => {
        if (message['type'] === 'CLEAR_REQUEST') {
          this.effectTracker.clearTimeline();
        }
      })
    ).subscribe();
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
    this.webSocketService.send(message);
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
