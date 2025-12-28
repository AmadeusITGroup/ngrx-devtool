import { Injectable, inject, NgZone, PLATFORM_ID, Injector, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface RenderPerformanceEntry {
  actionType: string;
  timestamp: number;
  /** Time for Angular to render components after state change (ms) */
  renderTime: number;
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
}

@Injectable({ providedIn: 'root' })
export class PerformanceTrackerService {
  private entries: RenderPerformanceEntry[] = [];
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Measure the actual component render time after a state change.
   *
   * Uses `afterNextRender` which fires after Angular has:
   * 1. Run change detection
   * 2. Updated the DOM
   * 3. Completed component rendering
   *
   * This gives accurate measurement of actual render work.
   */
  measureRenderTime<State>(
    actionType: string,
    reducer: () => State,
    callback: (renderTime: number) => void
  ): State {
    const startTime = performance.now();

    // Execute reducer
    const nextState = reducer();

    // Skip timing on server
    if (!this.isBrowser) {
      callback(0);
      return nextState;
    }

    // Use afterNextRender to measure when Angular finishes rendering
    // This is the most accurate way to measure component render time
    afterNextRender(() => {
      const endTime = performance.now();
      const renderTime = parseFloat((endTime - startTime).toFixed(2));

      // Record entry
      const entry: RenderPerformanceEntry = {
        actionType,
        timestamp: Date.now(),
        renderTime,
      };

      this.entries.push(entry);

      // Keep entries bounded
      if (this.entries.length > 1000) {
        this.entries = this.entries.slice(-500);
      }

      callback(renderTime);
    }, { injector: this.injector });

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

  /**
   * Get top N slowest renders by action.
   */
  getSlowestRenders(limit: number = 10): RenderPerformanceEntry[] {
    return [...this.entries]
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, limit);
  }

  /**
   * Clear all performance data.
   */
  clear(): void {
    this.entries = [];
  }
}
