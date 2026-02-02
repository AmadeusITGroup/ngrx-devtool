import { Injectable } from '@angular/core';

export interface SelectorMetrics {
  readonly name: string;
  invocationCount: number;
  recomputationCount: number;
  totalComputationTime: number;
  avgComputationTime: number;
  maxComputationTime: number;
  lastComputationTime: number;
  cacheHitRate: number;
  lastInvoked: number;
  triggeringActions: string[];
}

export interface SelectorInvocation {
  readonly selectorName: string;
  readonly timestamp: number;
  readonly computationTime: number;
  readonly wasRecomputed: boolean;
  readonly inputChanged: boolean;
  readonly triggeringAction?: string;
}

export interface EndToEndTiming {
  readonly actionType: string;
  readonly actionDispatchTime: number;
  readonly reducerCompleteTime: number;
  readonly selectorsCompleteTime: number;
  readonly totalTime: number;
  readonly reducerTime: number;
  readonly selectorTime: number;
  readonly affectedSelectors: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class SelectorTrackerService {
  private readonly selectorMetrics = new Map<string, SelectorMetrics>();
  private recentInvocations: SelectorInvocation[] = [];
  private pendingAction: { type: string; dispatchTime: number; reducerCompleteTime?: number; reducerTime?: number } | null = null;
  private endToEndTimings: EndToEndTiming[] = [];

  markActionDispatch(actionType: string): void {
    this.pendingAction = {
      type: actionType,
      dispatchTime: performance.now(),
    };
  }

  markReducerComplete(reducerTime: number): void {
    if (this.pendingAction) {
      this.pendingAction.reducerCompleteTime = performance.now();
      this.pendingAction.reducerTime = reducerTime;
    }
  }

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

    if (this.recentInvocations.length > 500) {
      this.recentInvocations = this.recentInvocations.slice(-250);
    }
  }

  markSelectorsComplete(): EndToEndTiming | null {
    if (!this.pendingAction) return null;

    const now = performance.now();

    const affectedSelectors = this.recentInvocations
      .filter(inv => inv.triggeringAction === this.pendingAction?.type)
      .map(inv => inv.selectorName)
      .filter((name, index, arr) => arr.indexOf(name) === index);

    const timing: EndToEndTiming = {
      actionType: this.pendingAction.type,
      actionDispatchTime: this.pendingAction.dispatchTime,
      reducerCompleteTime: this.pendingAction.reducerCompleteTime ?? now,
      selectorsCompleteTime: now,
      totalTime: now - this.pendingAction.dispatchTime,
      reducerTime: this.pendingAction.reducerTime ?? 0,
      selectorTime: now - (this.pendingAction.reducerCompleteTime ?? this.pendingAction.dispatchTime),
      affectedSelectors,
    };

    this.endToEndTimings.push(timing);
    if (this.endToEndTimings.length > 100) {
      this.endToEndTimings = this.endToEndTimings.slice(-50);
    }

    this.pendingAction = null;
    return timing;
  }

  getAllMetrics(): ReadonlyMap<string, SelectorMetrics> {
    return new Map(this.selectorMetrics);
  }

  getMetrics(selectorName: string): SelectorMetrics | undefined {
    return this.selectorMetrics.get(selectorName);
  }

  getSlowestSelectors(limit = 10): readonly SelectorMetrics[] {
    return Array.from(this.selectorMetrics.values())
      .sort((a, b) => b.totalComputationTime - a.totalComputationTime)
      .slice(0, limit);
  }

  getInefficientSelectors(cacheHitThreshold = 50): readonly SelectorMetrics[] {
    return Array.from(this.selectorMetrics.values())
      .filter(m => m.cacheHitRate < cacheHitThreshold && m.invocationCount > 5)
      .sort((a, b) => a.cacheHitRate - b.cacheHitRate);
  }

  getEndToEndTimings(): readonly EndToEndTiming[] {
    return [...this.endToEndTimings];
  }

  getAverageEndToEndTime(): number {
    if (this.endToEndTimings.length === 0) return 0;
    const total = this.endToEndTimings.reduce((sum, t) => sum + t.totalTime, 0);
    return total / this.endToEndTimings.length;
  }

  clear(): void {
    this.selectorMetrics.clear();
    this.recentInvocations = [];
    this.endToEndTimings = [];
    this.pendingAction = null;
  }
}
