import { Injectable, inject, PLATFORM_ID, Injector, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PerformanceWarning, PerformanceThresholds, ActionTypeStats, PerformanceWarningType } from '../../types/state.model';

export interface RenderPerformanceEntry {
  readonly actionType: string;
  readonly timestamp: number;
  readonly renderTime: number;
  readonly reducerTime?: number;
  readonly stateSize?: number;
}

export interface RenderPerformanceStats {
  readonly avgRenderTime: number;
  readonly maxRenderTime: number;
  readonly slowestAction: string | null;
  readonly totalActions: number;
}

export interface AggregatedPerformanceStats {
  readonly totalActions: number;
  readonly avgReducerTime: number;
  readonly maxReducerTime: number;
  readonly slowestAction: string | null;
  readonly currentStateSize: number;
  readonly actionsPerSecond: number;
  readonly performanceScore: number;
  readonly actionTypeStats: Map<string, ActionTypeStats>;
}

export interface WarningsSummary {
  readonly type: PerformanceWarningType;
  readonly count: number;
  readonly severity: 'low' | 'medium' | 'high';
}

const ENTRIES_MAX_SIZE = 1000;
const ENTRIES_TRIM_SIZE = 500;

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxReducerTime: 16,
  maxStateSize: 5 * 1024 * 1024,
  maxStateChangeSize: 1024 * 1024,
  maxActionsPerSecond: 60,
  maxPayloadSize: 100 * 1024,
};

@Injectable({ providedIn: 'root' })
export class PerformanceTrackerService {
  private entries: RenderPerformanceEntry[] = [];
  private warnings: PerformanceWarning[] = [];
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private thresholds = DEFAULT_THRESHOLDS;
  private firstActionTime: number | null = null;

  measureRenderTime<State>(
    actionType: string,
    reducer: () => State,
    callback: (renderTime: number, reducerTime: number, stateSize: number) => void
  ): State {
    const renderStartTime = performance.now();
    const reducerStartTime = performance.now();
    const nextState = reducer();
    const reducerTime = parseFloat((performance.now() - reducerStartTime).toFixed(2));
    const stateSize = this.getSerializedSize(nextState);

    if (!this.isBrowser) {
      callback(0, reducerTime, stateSize);
      return nextState;
    }

    afterNextRender(() => {
      const renderTime = parseFloat((performance.now() - renderStartTime).toFixed(2));

      const entry: RenderPerformanceEntry = {
        actionType,
        timestamp: Date.now(),
        renderTime,
        reducerTime,
        stateSize,
      };

      this.entries.push(entry);

      if (this.firstActionTime === null) {
        this.firstActionTime = entry.timestamp;
      }

      if (this.entries.length > ENTRIES_MAX_SIZE) {
        this.entries = this.entries.slice(-ENTRIES_TRIM_SIZE);
      }

      callback(renderTime, reducerTime, stateSize);
    }, { injector: this.injector });

    return nextState;
  }

  getEntries(): readonly RenderPerformanceEntry[] {
    return [...this.entries];
  }

  getStats(): RenderPerformanceStats {
    if (this.entries.length === 0) {
      return {
        avgRenderTime: 0,
        maxRenderTime: 0,
        slowestAction: null,
        totalActions: 0,
      };
    }

    const renderTimes = this.entries.map(e => e.renderTime);
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);

    const slowestEntry = this.entries.reduce((prev, curr) =>
      curr.renderTime > prev.renderTime ? curr : prev
    );

    return {
      avgRenderTime,
      maxRenderTime,
      slowestAction: slowestEntry.actionType,
      totalActions: this.entries.length,
    };
  }

  getAggregatedStats(): AggregatedPerformanceStats {
    const stats = this.getStats();
    const actionTypeStats = this.getActionTypeStats();
    const reducerTimes = this.entries.map(entry => entry.reducerTime ?? entry.renderTime);
    const avgReducerTime = reducerTimes.length
      ? reducerTimes.reduce((total, time) => total + time, 0) / reducerTimes.length
      : 0;
    const maxReducerTime = reducerTimes.length ? Math.max(...reducerTimes) : 0;
    const slowestReducer = this.entries.reduce<RenderPerformanceEntry | null>(
      (slowest, entry) => !slowest || (entry.reducerTime ?? entry.renderTime) > (slowest.reducerTime ?? slowest.renderTime)
        ? entry
        : slowest,
      null
    );
    const currentStateSize = this.entries.at(-1)?.stateSize ?? 0;
    const elapsedTime = this.firstActionTime
      ? (Date.now() - this.firstActionTime) / 1000
      : 1;

    return {
      totalActions: stats.totalActions,
      avgReducerTime,
      maxReducerTime,
      slowestAction: slowestReducer?.actionType ?? null,
      currentStateSize,
      actionsPerSecond: stats.totalActions / Math.max(elapsedTime, 1),
      performanceScore: this.calculatePerformanceScore(avgReducerTime, maxReducerTime),
      actionTypeStats,
    };
  }

  getThresholds(): PerformanceThresholds {
    return this.thresholds;
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getWarningsSummary(): WarningsSummary[] {
    const summaryMap = new Map<PerformanceWarningType, WarningsSummary>();

    for (const warning of this.warnings) {
      const existing = summaryMap.get(warning.type);
      if (existing) {
        summaryMap.set(warning.type, {
          ...existing,
          count: existing.count + 1,
          severity: this.maxSeverity(existing.severity, warning.severity),
        });
      } else {
        summaryMap.set(warning.type, {
          type: warning.type,
          count: 1,
          severity: warning.severity,
        });
      }
    }

    return Array.from(summaryMap.values());
  }

  getSlowestRenders(limit = 10): readonly RenderPerformanceEntry[] {
    return [...this.entries]
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, limit);
  }

  clear(): void {
    this.entries = [];
    this.warnings = [];
    this.firstActionTime = null;
  }

  private getActionTypeStats(): Map<string, ActionTypeStats> {
    const statsMap = new Map<string, ActionTypeStats>();

    for (const entry of this.entries) {
      const reducerTime = entry.reducerTime ?? entry.renderTime;
      const existing = statsMap.get(entry.actionType);
      if (existing) {
        existing.count++;
        existing.totalTime += reducerTime;
        existing.avgTime = existing.totalTime / existing.count;
        existing.maxTime = Math.max(existing.maxTime, reducerTime);
        existing.lastExecuted = entry.timestamp;
      } else {
        statsMap.set(entry.actionType, {
          count: 1,
          totalTime: reducerTime,
          avgTime: reducerTime,
          maxTime: reducerTime,
          lastExecuted: entry.timestamp,
        });
      }
    }

    return statsMap;
  }

  private calculatePerformanceScore(avgReducerTime: number, maxReducerTime: number): number {
    let score = 100;

    if (avgReducerTime > this.thresholds.maxReducerTime) {
      score -= Math.min(30, (avgReducerTime - this.thresholds.maxReducerTime) * 2);
    }

    if (maxReducerTime > this.thresholds.maxReducerTime * 2) {
      score -= Math.min(20, (maxReducerTime - this.thresholds.maxReducerTime * 2) / 2);
    }

    return Math.max(0, Math.round(score));
  }

  private getSerializedSize(value: unknown): number {
    try {
      const serialized = JSON.stringify(value);
      return serialized === undefined ? 0 : new TextEncoder().encode(serialized).byteLength;
    } catch {
      return 0;
    }
  }

  private maxSeverity(
    a: 'low' | 'medium' | 'high',
    b: 'low' | 'medium' | 'high'
  ): 'low' | 'medium' | 'high' {
    const order = { low: 0, medium: 1, high: 2 };
    return order[a] >= order[b] ? a : b;
  }
}
