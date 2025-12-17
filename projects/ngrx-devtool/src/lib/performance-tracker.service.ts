import { Injectable, ApplicationRef, inject } from '@angular/core';
import { Action } from '@ngrx/store';

export interface ComponentRenderMetrics {
  componentName: string;
  renderTime: number;
  phase: 'mount' | 'update';
}

export interface RenderPerformanceEntry {
  actionType: string;
  timestamp: number;
  totalRenderTime: number;
  componentsRendered: ComponentRenderMetrics[];
}

export interface RenderPerformanceStats {
  /** Average render time per action */
  avgRenderTime: number;
  /** Maximum render time */
  maxRenderTime: number;
  /** Action with slowest render */
  slowestAction: string | null;
  /** Total actions processed */
  totalActions: number;
  /** Most frequently re-rendered component */
  hottestComponent: string | null;
  /** Average number of components re-rendered per action */
  avgComponentsPerAction: number;
}

@Injectable({ providedIn: 'root' })
export class PerformanceTrackerService {
  private entries: RenderPerformanceEntry[] = [];
  private readonly appRef = inject(ApplicationRef);

  constructor() {
    console.log('[NgRx DevTool] PerformanceTrackerService initialized');
  }

  /**
   * Measure render time for an action and execute callback with the result.
   * Measures the synchronous time for reducer + change detection to complete.
   */
  measureRenderTime<State>(
    actionType: string,
    reducer: () => State,
    callback: (renderTime: number) => void
  ): State {
    const startTime = performance.now();

    // Execute reducer
    const nextState = reducer();

    const reducerEndTime = performance.now();
    const reducerTime = reducerEndTime - startTime;

    // Use setTimeout(0) to measure when the current execution context completes
    // This captures the synchronous rendering work without waiting for async operations
    setTimeout(() => {
      const endTime = performance.now();
      const renderTime = endTime - reducerEndTime; // Time after reducer completes

      // Record entry
      const entry: RenderPerformanceEntry = {
        actionType,
        timestamp: Date.now(),
        totalRenderTime: renderTime,
        componentsRendered: []
      };

      this.entries.push(entry);

      // Keep entries bounded
      if (this.entries.length > 1000) {
        this.entries = this.entries.slice(-500);
      }

      // Call the callback with render time
      callback(renderTime);
    }, 0);

    return nextState;
  }

  /**
   * Get all performance entries.
   */
  getEntries(): RenderPerformanceEntry[] {
    return [...this.entries];
  }

  /**
   * Get aggregated render performance statistics.
   */
  getStats(): RenderPerformanceStats {
    if (this.entries.length === 0) {
      return {
        avgRenderTime: 0,
        maxRenderTime: 0,
        slowestAction: null,
        totalActions: 0,
        hottestComponent: null,
        avgComponentsPerAction: 0
      };
    }

    const renderTimes = this.entries.map(e => e.totalRenderTime);
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);

    const slowestEntry = this.entries.reduce((prev, curr) =>
      curr.totalRenderTime > prev.totalRenderTime ? curr : prev
    );

    // Calculate avg components per action
    const totalComponents = this.entries.reduce((sum, e) => sum + e.componentsRendered.length, 0);
    const avgComponentsPerAction = totalComponents / this.entries.length;

    return {
      avgRenderTime,
      maxRenderTime,
      slowestAction: slowestEntry.actionType,
      totalActions: this.entries.length,
      hottestComponent: null,
      avgComponentsPerAction
    };
  }

  /**
   * Get top N slowest renders by action.
   */
  getSlowestRenders(limit: number = 10): RenderPerformanceEntry[] {
    return [...this.entries]
      .sort((a, b) => b.totalRenderTime - a.totalRenderTime)
      .slice(0, limit);
  }

  /**
   * Clear all performance data.
   */
  clear(): void {
    this.entries = [];
  }
}
