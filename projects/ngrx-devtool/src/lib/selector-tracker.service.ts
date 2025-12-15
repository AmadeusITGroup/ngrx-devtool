import { Injectable } from '@angular/core';
import { MemoizedSelector, createSelector } from '@ngrx/store';

export interface SelectorMetrics {
  /** Name/identifier of the selector */
  name: string;
  /** Number of times the selector was invoked */
  invocationCount: number;
  /** Number of times the selector recomputed (cache miss) */
  recomputationCount: number;
  /** Total time spent in selector computations (ms) */
  totalComputationTime: number;
  /** Average computation time (ms) */
  avgComputationTime: number;
  /** Max computation time (ms) */
  maxComputationTime: number;
  /** Last computation time (ms) */
  lastComputationTime: number;
  /** Cache hit rate (0-100%) */
  cacheHitRate: number;
  /** Last invocation timestamp */
  lastInvoked: number;
  /** Actions that triggered this selector */
  triggeringActions: string[];
}

export interface SelectorInvocation {
  selectorName: string;
  timestamp: number;
  computationTime: number;
  wasRecomputed: boolean;
  inputChanged: boolean;
  triggeringAction?: string;
}

export interface EndToEndTiming {
  actionType: string;
  actionDispatchTime: number;
  reducerCompleteTime: number;
  selectorsCompleteTime: number;
  totalTime: number;
  reducerTime: number;
  selectorTime: number;
  affectedSelectors: string[];
}

@Injectable({ providedIn: 'root' })
export class SelectorTrackerService {
  private selectorMetrics = new Map<string, SelectorMetrics>();
  private recentInvocations: SelectorInvocation[] = [];
  private pendingAction: { type: string; dispatchTime: number } | null = null;
  private endToEndTimings: EndToEndTiming[] = [];

  constructor() {
    console.log('[NgRx DevTool] SelectorTrackerService initialized');
  }

  /**
   * Mark the start of an action dispatch for end-to-end timing.
   */
  markActionDispatch(actionType: string): void {
    this.pendingAction = {
      type: actionType,
      dispatchTime: performance.now(),
    };
  }

  /**
   * Record reducer completion time.
   */
  markReducerComplete(reducerTime: number): void {
    if (this.pendingAction) {
      (this.pendingAction as any).reducerCompleteTime = performance.now();
      (this.pendingAction as any).reducerTime = reducerTime;
    }
  }

  /**
   * Record a selector invocation.
   */
  recordSelectorInvocation(
    selectorName: string,
    computationTime: number,
    wasRecomputed: boolean,
    inputChanged: boolean
  ): void {
    const invocation: SelectorInvocation = {
      selectorName,
      timestamp: Date.now(),
      computationTime,
      wasRecomputed,
      inputChanged,
      triggeringAction: this.pendingAction?.type,
    };

    this.recentInvocations.push(invocation);

    // Update metrics
    const existing = this.selectorMetrics.get(selectorName);
    if (existing) {
      existing.invocationCount++;
      if (wasRecomputed) {
        existing.recomputationCount++;
        existing.totalComputationTime += computationTime;
        existing.avgComputationTime = existing.totalComputationTime / existing.recomputationCount;
        existing.maxComputationTime = Math.max(existing.maxComputationTime, computationTime);
        existing.lastComputationTime = computationTime;
      }
      existing.cacheHitRate = ((existing.invocationCount - existing.recomputationCount) / existing.invocationCount) * 100;
      existing.lastInvoked = Date.now();
      if (this.pendingAction?.type && !existing.triggeringActions.includes(this.pendingAction.type)) {
        existing.triggeringActions.push(this.pendingAction.type);
        // Keep only last 10 actions
        if (existing.triggeringActions.length > 10) {
          existing.triggeringActions.shift();
        }
      }
    } else {
      this.selectorMetrics.set(selectorName, {
        name: selectorName,
        invocationCount: 1,
        recomputationCount: wasRecomputed ? 1 : 0,
        totalComputationTime: wasRecomputed ? computationTime : 0,
        avgComputationTime: wasRecomputed ? computationTime : 0,
        maxComputationTime: wasRecomputed ? computationTime : 0,
        lastComputationTime: wasRecomputed ? computationTime : 0,
        cacheHitRate: wasRecomputed ? 0 : 100,
        lastInvoked: Date.now(),
        triggeringActions: this.pendingAction?.type ? [this.pendingAction.type] : [],
      });
    }

    // Keep invocations bounded
    if (this.recentInvocations.length > 500) {
      this.recentInvocations = this.recentInvocations.slice(-250);
    }
  }

  /**
   * Mark selectors complete and calculate end-to-end timing.
   */
  markSelectorsComplete(): EndToEndTiming | null {
    if (!this.pendingAction) return null;

    const now = performance.now();
    const pendingWithReducer = this.pendingAction as any;

    // Find selectors invoked after the action
    const affectedSelectors = this.recentInvocations
      .filter(inv => inv.triggeringAction === this.pendingAction?.type)
      .map(inv => inv.selectorName)
      .filter((name, index, arr) => arr.indexOf(name) === index);

    const timing: EndToEndTiming = {
      actionType: this.pendingAction.type,
      actionDispatchTime: this.pendingAction.dispatchTime,
      reducerCompleteTime: pendingWithReducer.reducerCompleteTime || now,
      selectorsCompleteTime: now,
      totalTime: now - this.pendingAction.dispatchTime,
      reducerTime: pendingWithReducer.reducerTime || 0,
      selectorTime: now - (pendingWithReducer.reducerCompleteTime || this.pendingAction.dispatchTime),
      affectedSelectors,
    };

    this.endToEndTimings.push(timing);
    if (this.endToEndTimings.length > 100) {
      this.endToEndTimings = this.endToEndTimings.slice(-50);
    }

    this.pendingAction = null;
    return timing;
  }

  /**
   * Get all selector metrics.
   */
  getAllMetrics(): Map<string, SelectorMetrics> {
    return new Map(this.selectorMetrics);
  }

  /**
   * Get metrics for a specific selector.
   */
  getMetrics(selectorName: string): SelectorMetrics | undefined {
    return this.selectorMetrics.get(selectorName);
  }

  /**
   * Get selectors sorted by total computation time (slowest first).
   */
  getSlowestSelectors(limit: number = 10): SelectorMetrics[] {
    return Array.from(this.selectorMetrics.values())
      .sort((a, b) => b.totalComputationTime - a.totalComputationTime)
      .slice(0, limit);
  }

  /**
   * Get selectors with low cache hit rates.
   */
  getInefficientSelectors(cacheHitThreshold: number = 50): SelectorMetrics[] {
    return Array.from(this.selectorMetrics.values())
      .filter(m => m.cacheHitRate < cacheHitThreshold && m.invocationCount > 5)
      .sort((a, b) => a.cacheHitRate - b.cacheHitRate);
  }

  /**
   * Get recent end-to-end timings.
   */
  getEndToEndTimings(): EndToEndTiming[] {
    return [...this.endToEndTimings];
  }

  /**
   * Get average end-to-end time.
   */
  getAverageEndToEndTime(): number {
    if (this.endToEndTimings.length === 0) return 0;
    const total = this.endToEndTimings.reduce((sum, t) => sum + t.totalTime, 0);
    return total / this.endToEndTimings.length;
  }

  /**
   * Clear all tracking data.
   */
  clear(): void {
    this.selectorMetrics.clear();
    this.recentInvocations = [];
    this.endToEndTimings = [];
    this.pendingAction = null;
  }
}
