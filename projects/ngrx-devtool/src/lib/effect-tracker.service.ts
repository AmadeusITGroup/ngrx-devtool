import { inject, Injectable } from '@angular/core';
import { Action } from '@ngrx/store';
import { EffectSources } from '@ngrx/effects';
import { DevToolsEffectSources, EffectEvent } from './devtools-effect-sources';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface EffectInvocation {
  triggerAction: string;
  resultAction: string | null;
  effectId: string;
  effectName?: string;
  timestamp: string;
  duration?: number;
}

export interface TrackedAction {
  action: string;
  payload: any;
  timestamp: number;
  source: 'user' | 'effect';
  correlationId?: string;
  effectName?: string;
}

/**
 * Tracked effect execution with full lifecycle information
 */
export interface TrackedEffect {
  effectName: string;
  sourceName: string | null;
  propertyName: string;
  triggerAction?: string;
  resultAction?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'error';
  error?: any;
}

@Injectable({ providedIn: 'root' })
export class EffectTrackerService {
  private readonly effectSources = inject(EffectSources, { optional: true });

  private destroy$ = new Subject<void>();
  private actionTimeline: TrackedAction[] = [];
  private effectTimeline: TrackedEffect[] = [];
  private effectActionPatterns = new Set<string>();
  private pendingCorrelations = new Map<string, { action: Action; timestamp: number; effectName?: string }>();
  private runningEffects = new Map<string, TrackedEffect>();
  private correlationCounter = 0;
  private lastTriggerAction: Action | null = null;

  /**
   * Observable of effect events (if DevToolsEffectSources is provided).
   * Uses ReplaySubject to allow ActionsInterceptorService to receive events
   * that were emitted before it subscribed during APP_INITIALIZER.
   */
  readonly effectEvents$ = new ReplaySubject<EffectEvent>(100);

  constructor() {
    // Subscribe to effect events if DevToolsEffectSources is provided
    this.subscribeToEffectEvents();
  }

  /**
   * Subscribe to DevToolsEffectSources if available
   */
  private subscribeToEffectEvents(): void {
    // Check if effectSources has effectEvents$ (duck typing for DevToolsEffectSources)
    // This is more reliable than instanceof check which can fail due to DI timing
    const devToolsSources = this.effectSources as any;

    if (devToolsSources && devToolsSources.effectEvents$ && typeof devToolsSources.effectEvents$.subscribe === 'function') {
      console.log('[NgRx DevTool] DevToolsEffectSources detected - enabling effect lifecycle tracking');

      devToolsSources.effectEvents$.pipe(
        takeUntil(this.destroy$)
      ).subscribe((event: EffectEvent) => {
        this.handleEffectEvent(event);
        this.effectEvents$.next(event);
      });
    } else {
      console.log('[NgRx DevTool] DevToolsEffectSources not detected - using heuristic effect detection');
    }
  }

  /**
   * Handle effect lifecycle events from DevToolsEffectSources
   *
   * With the new model, we only get 'emitted' or 'error' events.
   * Each emission is a complete execution cycle (no more running/started state).
   */
  private handleEffectEvent(event: EffectEvent): void {
    switch (event.lifecycle) {
      case 'emitted':
        // Effect emitted an action - this is a complete execution
        if (event.action) {
          const trackedEffect: TrackedEffect = {
            effectName: event.effectName,
            sourceName: event.sourceName,
            propertyName: event.propertyName,
            triggerAction: this.lastTriggerAction?.type,
            resultAction: event.action.type,
            startTime: event.timestamp - (event.duration || 0),
            endTime: event.timestamp,
            duration: event.duration,
            status: 'completed',
          };

          this.effectTimeline.push(trackedEffect);

          // Mark this action type as coming from an effect
          this.effectActionPatterns.add(event.action.type);

          console.log(`[NgRx DevTool] Effect executed: ${event.effectName} -> ${event.action.type} (${event.duration}ms)`);
        }
        break;

      case 'error':
        // Effect errored
        const erroredEffect: TrackedEffect = {
          effectName: event.effectName,
          sourceName: event.sourceName,
          propertyName: event.propertyName,
          triggerAction: this.lastTriggerAction?.type,
          startTime: event.timestamp - (event.duration || 0),
          endTime: event.timestamp,
          duration: event.duration,
          status: 'error',
          error: event.error,
        };

        this.effectTimeline.push(erroredEffect);
        console.error(`[NgRx DevTool] Effect error: ${event.effectName}`, event.error);
        break;

      case 'triggered':
        // Optional: track when effect starts processing (if we implement it later)
        console.log(`[NgRx DevTool] Effect triggered: ${event.effectName}`);
        break;
    }

    // Keep effect timeline bounded
    if (this.effectTimeline.length > 500) {
      this.effectTimeline = this.effectTimeline.slice(-250);
    }
  }

  /**
   * Register action types that are known to be dispatched by effects.
   * This improves accuracy of effect detection.
   */
  registerEffectActionType(actionType: string): void {
    this.effectActionPatterns.add(actionType);
  }

  /**
   * Register multiple effect action types at once.
   */
  registerEffectActionTypes(actionTypes: string[]): void {
    actionTypes.forEach(type => this.effectActionPatterns.add(type));
  }

  /**
   * Check if an action is likely dispatched by an effect.
   * Uses registered patterns + heuristic detection.
   */
  isEffectAction(actionType: string): boolean {
    // Check registered patterns first
    if (this.effectActionPatterns.has(actionType)) {
      return true;
    }

    // Heuristic detection based on NgRx conventions
    // These patterns identify actions that are RESULTS of effects (not triggers)
    const effectPatterns = [
      /-> Succeeded/i,          // [Competitors API] Fetch -> Succeeded
      /-> Failed/i,             // [Competitors API] Fetch -> Failed
      /-> Success/i,            // [API] Action -> Success
      /-> Failure/i,            // [API] Action -> Failure
      /-> Error/i,              // [API] Action -> Error
      /-> Complete/i,           // [API] Action -> Complete
      /Success$/i,              // loadBooksSuccess
      /Succeeded$/i,            // fetchCompetitorsSucceeded
      /Failure$/i,              // loadBooksFailure
      /Failed$/i,               // fetchCompetitorsFailed
      /Error$/i,                // loadBooksError
      /Complete$/i,             // loadBooksComplete
      /Completed$/i,            // loadBooksCompleted
      /Retrieved/i,             // retrievedBookList
      /Loaded$/i,               // booksLoaded
      /Fetched$/i,              // booksFetched
    ];

    return effectPatterns.some(pattern => pattern.test(actionType));
  }

  /**
   * Track an action and correlate it to effects if applicable.
   */
  trackAction(action: Action): TrackedAction {
    const isEffect = this.isEffectAction(action.type);

    // Store last non-effect action as potential trigger
    if (!isEffect) {
      this.lastTriggerAction = action;
    }

    const correlationId = isEffect
      ? this.findCorrelation(action.type)
      : this.createCorrelation(action);

    // Find effect name if this action was emitted by a tracked effect
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

    // Keep timeline bounded
    if (this.actionTimeline.length > 1000) {
      this.actionTimeline = this.actionTimeline.slice(-500);
    }

    return tracked;
  }

  /**
   * Get the full action timeline.
   */
  getTimeline(): TrackedAction[] {
    return [...this.actionTimeline];
  }

  /**
   * Get actions grouped by correlation (user action -> effect results).
   */
  getCorrelatedActions(): Map<string, TrackedAction[]> {
    const groups = new Map<string, TrackedAction[]>();

    this.actionTimeline.forEach(tracked => {
      if (tracked.correlationId) {
        if (!groups.has(tracked.correlationId)) {
          groups.set(tracked.correlationId, []);
        }
        groups.get(tracked.correlationId)!.push(tracked);
      }
    });

    return groups;
  }

  /**
   * Clear the action timeline.
   */
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

    // Clean up old correlations after 30 seconds
    setTimeout(() => {
      this.pendingCorrelations.delete(correlationId);
    }, 30000);

    return correlationId;
  }

  private findCorrelation(actionType: string): string | undefined {
    // Find the most recent pending correlation
    // In a real implementation, you might want more sophisticated matching
    const entries = Array.from(this.pendingCorrelations.entries());
    if (entries.length > 0) {
      return entries[entries.length - 1][0];
    }
    return undefined;
  }

  /**
   * Find the effect name that emitted a given action type.
   * Uses the effect timeline to match recently emitted actions.
   */
  private findEffectNameForAction(actionType: string): string | undefined {
    // Check running effects first
    for (const [_, effect] of this.runningEffects) {
      if (effect.resultAction === actionType) {
        return effect.effectName;
      }
    }

    // Check recent completed effects
    for (let i = this.effectTimeline.length - 1; i >= Math.max(0, this.effectTimeline.length - 10); i--) {
      const effect = this.effectTimeline[i];
      if (effect.resultAction === actionType) {
        return effect.effectName;
      }
    }

    return undefined;
  }

  /**
   * Get the effect timeline (tracked effect executions).
   */
  getEffectTimeline(): TrackedEffect[] {
    return [...this.effectTimeline];
  }

  /**
   * Get currently running effects.
   */
  getRunningEffects(): TrackedEffect[] {
    return Array.from(this.runningEffects.values());
  }

  /**
   * Clear all timelines.
   */
  clearAll(): void {
    this.actionTimeline = [];
    this.effectTimeline = [];
    this.pendingCorrelations.clear();
    this.runningEffects.clear();
    this.lastTriggerAction = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.effectEvents$.complete();
  }
}
