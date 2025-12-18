import { Injectable, ApplicationRef, inject, NgZone } from '@angular/core';
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
  private readonly ngZone = inject(NgZone);

  constructor() {
    console.log('[NgRx DevTool] PerformanceTrackerService initialized');
  }

  /**
   * Measure render time for an action and execute callback with the result.
   * Uses Angular's ApplicationRef.isStable to detect when change detection completes.
   */
  measureRenderTime<State>(
    actionType: string,
    reducer: () => State,
    callback: (renderTime: number) => void
  ): State {
    const startTime = performance.now();

    // Execute reducer
    const nextState = reducer();

    // Use requestAnimationFrame to measure after the browser has painted
    // This gives us a more accurate measure of actual render time
    this.ngZone.runOutsideAngular(() => {
      // First RAF: Angular processes change detection
      requestAnimationFrame(() => {
        // Second RAF: Browser has painted the changes
        requestAnimationFrame(() => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;

          // Record entry
          const entry: RenderPerformanceEntry = {
            actionType,
            timestamp: Date.now(),
            totalRenderTime: parseFloat(renderTime.toFixed(2)),
            componentsRendered: []
          };

          this.entries.push(entry);

          // Keep entries bounded
          if (this.entries.length > 1000) {
            this.entries = this.entries.slice(-500);
          }

          // Call the callback with render time
          callback(parseFloat(renderTime.toFixed(2)));
        });
      });
    });

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
