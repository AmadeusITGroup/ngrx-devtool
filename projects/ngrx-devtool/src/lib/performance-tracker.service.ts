import { Injectable, inject, PLATFORM_ID, Injector, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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

const ENTRIES_MAX_SIZE = 1000;
const ENTRIES_TRIM_SIZE = 500;

@Injectable({ providedIn: 'root' })
export class PerformanceTrackerService {
  private entries: RenderPerformanceEntry[] = [];
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

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

  getSlowestRenders(limit = 10): readonly RenderPerformanceEntry[] {
    return [...this.entries]
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, limit);
  }

  clear(): void {
    this.entries = [];
  }
}
