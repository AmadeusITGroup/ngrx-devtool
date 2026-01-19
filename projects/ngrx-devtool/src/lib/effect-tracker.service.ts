import { inject, Injectable, OnDestroy } from '@angular/core';
import { Action } from '@ngrx/store';
import { EffectSources } from '@ngrx/effects';
import { DevToolsEffectSources, EffectEvent } from './devtools-effect-sources';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface TrackedAction {
  readonly action: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly source: 'user' | 'effect';
  readonly correlationId?: string;
  readonly effectName?: string;
}

export interface TrackedEffect {
  readonly effectName: string;
  readonly sourceName: string | null;
  readonly propertyName: string;
  readonly triggerAction?: string;
  readonly resultAction?: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly status: 'completed' | 'error';
  readonly error?: unknown;
}

const REPLAY_BUFFER_SIZE = 100;
const TIMELINE_MAX_SIZE = 1000;
const TIMELINE_TRIM_SIZE = 500;
const EFFECT_TIMELINE_MAX_SIZE = 500;
const CORRELATION_TIMEOUT_MS = 30000;

@Injectable({ providedIn: 'root' })
export class EffectTrackerService implements OnDestroy {
  private readonly effectSources = inject(EffectSources, { optional: true });
  private readonly destroy$ = new Subject<void>();

  private actionTimeline: TrackedAction[] = [];
  private effectTimeline: TrackedEffect[] = [];
  private readonly effectActionPatterns = new Set<string>();
  private readonly pendingCorrelations = new Map<string, { action: Action; timestamp: number }>();
  private correlationCounter = 0;
  private lastTriggerAction: Action | null = null;

  readonly effectEvents$ = new ReplaySubject<EffectEvent>(REPLAY_BUFFER_SIZE);

  constructor() {
    this.subscribeToEffectEvents();
  }

  private subscribeToEffectEvents(): void {
    const devToolsSources = this.effectSources as DevToolsEffectSources | null;

    if (devToolsSources?.effectEvents$) {

      devToolsSources.effectEvents$.pipe(
        takeUntil(this.destroy$)
      ).subscribe((event: EffectEvent) => {
        this.handleEffectEvent(event);
        this.effectEvents$.next(event);
      });
    }
  }

  private handleEffectEvent(event: EffectEvent): void {
    switch (event.lifecycle) {
      case 'emitted':
        if (event.action) {
          const trackedEffect: TrackedEffect = {
            effectName: event.effectName,
            sourceName: event.sourceName,
            propertyName: event.propertyName,
            triggerAction: this.lastTriggerAction?.type,
            resultAction: event.action.type,
            startTime: event.timestamp - (event.duration ?? 0),
            endTime: event.timestamp,
            duration: event.duration,
            status: 'completed',
          };
          this.effectTimeline.push(trackedEffect);
          this.effectActionPatterns.add(event.action.type);
        }
        break;

      case 'error': {
        const erroredEffect: TrackedEffect = {
          effectName: event.effectName,
          sourceName: event.sourceName,
          propertyName: event.propertyName,
          triggerAction: this.lastTriggerAction?.type,
          startTime: event.timestamp - (event.duration ?? 0),
          endTime: event.timestamp,
          duration: event.duration,
          status: 'error',
          error: event.error,
        };
        this.effectTimeline.push(erroredEffect);
        break;
      }
    }

    if (this.effectTimeline.length > EFFECT_TIMELINE_MAX_SIZE) {
      this.effectTimeline = this.effectTimeline.slice(-EFFECT_TIMELINE_MAX_SIZE / 2);
    }
  }

  isEffectAction(actionType: string): boolean {
    return this.effectActionPatterns.has(actionType);
  }

  trackAction(action: Action): TrackedAction {
    const isEffect = this.isEffectAction(action.type);

    if (!isEffect) {
      this.lastTriggerAction = action;
    }

    const correlationId = isEffect
      ? this.findCorrelation(action.type)
      : this.createCorrelation(action);

    const effectName = this.findEffectNameForAction(action.type);

    const tracked: TrackedAction = {
      action: action.type,
      payload: action,
      timestamp: Date.now(),
      source: isEffect ? 'effect' : 'user',
      correlationId,
      effectName,
    };

    this.actionTimeline.push(tracked);

    if (this.actionTimeline.length > TIMELINE_MAX_SIZE) {
      this.actionTimeline = this.actionTimeline.slice(-TIMELINE_TRIM_SIZE);
    }

    return tracked;
  }

  getTimeline(): readonly TrackedAction[] {
    return [...this.actionTimeline];
  }

  clearTimeline(): void {
    this.actionTimeline = [];
    this.pendingCorrelations.clear();
  }

  private createCorrelation(action: Action): string {
    const correlationId = `corr_${++this.correlationCounter}_${Date.now()}`;
    this.pendingCorrelations.set(correlationId, {
      action,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      this.pendingCorrelations.delete(correlationId);
    }, CORRELATION_TIMEOUT_MS);

    return correlationId;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private findCorrelation(_actionType: string): string | undefined {
    const entries = Array.from(this.pendingCorrelations.entries());
    return entries.length > 0 ? entries[entries.length - 1][0] : undefined;
  }

  private findEffectNameForAction(actionType: string): string | undefined {
    // Check recent completed effects
    for (let i = this.effectTimeline.length - 1; i >= Math.max(0, this.effectTimeline.length - 10); i--) {
      const effect = this.effectTimeline[i];
      if (effect.resultAction === actionType) {
        return effect.effectName;
      }
    }

    return undefined;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.effectEvents$.complete();
  }
}
