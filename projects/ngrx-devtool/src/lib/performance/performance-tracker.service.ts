import { Injectable, inject, PLATFORM_ID, Injector, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PerformanceWarning, PerformanceThresholds, ActionTypeStats, PerformanceWarningType } from '../../types/state.model';

export interface RenderPerformanceEntry {
  readonly actionType: string;
  readonly timestamp: number;
  readonly renderTime: number;
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
    callback: (renderTime: number) => void
  ): State {
    const startTime = performance.now();
    const nextState = reducer();

    if (!this.isBrowser) {
      callback(0);
      return nextState;
    }

    afterNextRender(() => {
      const renderTime = parseFloat((performance.now() - startTime).toFixed(2));

      const entry: RenderPerformanceEntry = {
        actionType,
        timestamp: Date.now(),
        renderTime,
      };

      this.entries.push(entry);

      if (this.firstActionTime === null) {
        this.firstActionTime = entry.timestamp;
      }

      if (this.entries.length > ENTRIES_MAX_SIZE) {
        this.entries = this.entries.slice(-ENTRIES_TRIM_SIZE);
      }

      callback(renderTime);
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
    const elapsedTime = this.firstActionTime
      ? (Date.now() - this.firstActionTime) / 1000
      : 1;

    return {
      totalActions: stats.totalActions,
      avgReducerTime: stats.avgRenderTime,
      maxReducerTime: stats.maxRenderTime,
      slowestAction: stats.slowestAction,
      currentStateSize: 0,
      actionsPerSecond: stats.totalActions / Math.max(elapsedTime, 1),
      performanceScore: this.calculatePerformanceScore(stats),
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
      const existing = statsMap.get(entry.actionType);
      if (existing) {
        existing.count++;
        existing.totalTime += entry.renderTime;
        existing.avgTime = existing.totalTime / existing.count;
        existing.maxTime = Math.max(existing.maxTime, entry.renderTime);
        existing.lastExecuted = entry.timestamp;
      } else {
        statsMap.set(entry.actionType, {
          count: 1,
          totalTime: entry.renderTime,
          avgTime: entry.renderTime,
          maxTime: entry.renderTime,
          lastExecuted: entry.timestamp,
        });
      }
    }

    return statsMap;
  }

  private calculatePerformanceScore(stats: RenderPerformanceStats): number {
    let score = 100;

    if (stats.avgRenderTime > this.thresholds.maxReducerTime) {
      score -= Math.min(30, (stats.avgRenderTime - this.thresholds.maxReducerTime) * 2);
    }

    if (stats.maxRenderTime > this.thresholds.maxReducerTime * 2) {
      score -= Math.min(20, (stats.maxRenderTime - this.thresholds.maxReducerTime * 2) / 2);
    }

    return Math.max(0, Math.round(score));
  }

  private maxSeverity(
    a: 'low' | 'medium' | 'high',
    b: 'low' | 'medium' | 'high'
  ): 'low' | 'medium' | 'high' {
    const order = { low: 0, medium: 1, high: 2 };
    return order[a] >= order[b] ? a : b;
  }
}
