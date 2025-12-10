import { Injectable } from '@angular/core';
import { Action } from '@ngrx/store';
export interface EffectInvocation {
  triggerAction: string;
  resultAction: string | null;
  effectId: string;
  timestamp: string;
  duration?: number;
}

export interface TrackedAction {
  action: string;
  payload: any;
  timestamp: number;
  source: 'user' | 'effect';
  correlationId?: string;
}

@Injectable({ providedIn: 'root' })
export class EffectTrackerService {
  private actionTimeline: TrackedAction[] = [];
  private effectActionPatterns = new Set<string>();
  private pendingCorrelations = new Map<string, { action: Action; timestamp: number }>();
  private correlationCounter = 0;

  constructor() {
    console.log('[NgRx DevTool] EffectTrackerService initialized - Version: 2025-12-09');
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
    const correlationId = isEffect
      ? this.findCorrelation(action.type)
      : this.createCorrelation(action);

    const tracked: TrackedAction = {
      action: action.type,
      payload: action,
      timestamp: Date.now(),
      source: isEffect ? 'effect' : 'user',
      correlationId,
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
}
