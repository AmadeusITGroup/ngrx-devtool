import { inject, Injectable, OnDestroy } from '@angular/core';
import { Action } from '@ngrx/store';
import { EffectSources } from '@ngrx/effects';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EffectEvent, TrackedAction, TrackedEffect } from './core.models';
import { DevToolsEffectSources } from './devtools-effect-sources';

const REPLAY_BUFFER_SIZE = 100;
const TIMELINE_MAX_SIZE = 1000;
const TIMELINE_TRIM_SIZE = 500;
const EFFECT_TIMELINE_MAX_SIZE = 500;
const CORRELATION_TIMEOUT_MS = 30000;

interface PendingCorrelation {
  readonly correlationId: string;
  readonly actionType: string;
  readonly timestamp: number;
  readonly timeoutId: ReturnType<typeof setTimeout>;
}

@Injectable({ providedIn: 'root' })
export class EffectTrackerService implements OnDestroy {
  private readonly effectSources = inject(EffectSources, { optional: true });
  private readonly destroy$ = new Subject<void>();

  private actionTimeline: TrackedAction[] = [];
  private effectTimeline: TrackedEffect[] = [];
  private readonly effectActionPatterns = new Set<string>();
  private pendingCorrelations: PendingCorrelation[] = [];
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

    // Resolve trigger action type to match the correct correlation.
    const triggerActionType = isEffect
      ? this.findTriggerActionType(action.type)
      : undefined;

    const correlationId = isEffect
      ? this.consumeCorrelation(triggerActionType)
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
    this.clearPendingCorrelations();
  }

  private createCorrelation(action: Action): string {
    const correlationId = `corr_${++this.correlationCounter}_${Date.now()}`;

    const timeoutId = setTimeout(() => {
      this.pendingCorrelations = this.pendingCorrelations.filter(
        c => c.correlationId !== correlationId
      );
    }, CORRELATION_TIMEOUT_MS);

    this.pendingCorrelations.push({
      correlationId,
      actionType: action.type,
      timestamp: Date.now(),
      timeoutId,
    });

    return correlationId;
  }

  // Find and consume the best-matching pending correlation (by trigger type, then FIFO fallback).
  private consumeCorrelation(triggerActionType?: string): string | undefined {
    let idx = -1;

    // Prefer matching by trigger action type (oldest match first)
    if (triggerActionType) {
      idx = this.pendingCorrelations.findIndex(c => c.actionType === triggerActionType);
    }

    // Fallback: oldest pending correlation (FIFO)
    if (idx === -1 && this.pendingCorrelations.length > 0) {
      idx = 0;
    }

    if (idx === -1) {
      return undefined;
    }

    const [entry] = this.pendingCorrelations.splice(idx, 1);
    clearTimeout(entry.timeoutId);
    return entry.correlationId;
  }

  // Resolve which user action type triggered a given effect-result action type.
  private findTriggerActionType(effectActionType: string): string | undefined {
    for (let i = this.effectTimeline.length - 1; i >= Math.max(0, this.effectTimeline.length - 10); i--) {
      const effect = this.effectTimeline[i];
      if (effect.resultAction === effectActionType && effect.triggerAction) {
        return effect.triggerAction;
      }
    }
    return undefined;
  }

  private findEffectNameForAction(actionType: string): string | undefined {
    for (let i = this.effectTimeline.length - 1; i >= Math.max(0, this.effectTimeline.length - 10); i--) {
      const effect = this.effectTimeline[i];
      if (effect.resultAction === actionType) {
        return effect.effectName;
      }
    }

    return undefined;
  }

  private clearPendingCorrelations(): void {
    for (const entry of this.pendingCorrelations) {
      clearTimeout(entry.timeoutId);
    }
    this.pendingCorrelations = [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.effectEvents$.complete();
    this.clearPendingCorrelations();
  }
}
