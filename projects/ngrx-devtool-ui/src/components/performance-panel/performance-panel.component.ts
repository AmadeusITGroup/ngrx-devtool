import { Component, Input, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

interface RenderPerformance {
  renderTime: number;
}

interface PerformanceData {
  reducerExecutionTime: number;
  stateSize: number;
  stateSizeChange: number;
  actionPayloadSize: number;
  warnings?: { severity: string; message: string; suggestion?: string }[];
}

interface RenderTimingMessage {
  type: 'RENDER_TIMING';
  actionType: string;
  reducerTime: number;
  renderTime: number;
  totalTime: number;
  timestamp: string;
}

export interface StateChangeMessage {
  type: string;
  action: { type: string };
  nextState?: unknown;
  effectName?: string;
  isEffectResult?: boolean;
  timestamp: string;
  performance?: PerformanceData;
  renderPerformance?: RenderPerformance;
  renderTiming?: RenderTimingMessage;
}

interface RenderEntry {
  actionType: string;
  renderTime: number;
}

interface RenderStats {
  avgRenderTime: number;
  maxRenderTime: number;
  totalActions: number;
}

const STATUS_COLORS = {
  good: '#4caf50',
  warning: '#ff9800',
  critical: '#f44336',
} as const;

const OPTIMIZATION_TIPS = [
  { threshold: 32, text: 'Use OnPush change detection strategy', docUrl: 'https://angular.dev/best-practices/skipping-subtrees#using-onpush' },
  { threshold: 50, text: 'Add trackBy to *ngFor loops', docUrl: 'https://angular.dev/api/common/NgFor#description' },
  { threshold: 100, text: 'Use virtual scrolling for large lists', docUrl: 'https://material.angular.io/cdk/scrolling/overview#virtual-scrolling' },
  { threshold: 100, text: 'Defer heavy components with @defer', docUrl: 'https://angular.dev/guide/defer' },
  { threshold: 150, text: 'Use signals for fine-grained reactivity', docUrl: 'https://angular.dev/guide/signals' },
];

/** Tooltip definitions for metrics */
export const METRIC_TOOLTIPS = {
  avgRenderTime: `Average Render Time

Formula: Sum of all render times ÷ Total actions

How it's measured:
• Timer starts when action is dispatched
• Timer ends when afterNextRender() fires
• afterNextRender() executes after Angular completes change detection and DOM updates

This represents the average time Angular takes to re-render components after each state change.`,

  maxRenderTime: `Maximum Render Time

Formula: Max(all render times)

The slowest render recorded across all tracked actions. High values indicate specific actions that cause expensive re-renders.

Target: < 16ms for 60fps, < 32ms acceptable`,

  totalActions: `Total Actions Tracked

The number of NgRx actions that triggered a state change and were measured for render performance.

Only STATE_CHANGE messages with renderPerformance data are counted.`,

  renderTime: `Render Time

How it's measured:
1. Action dispatched → Timer starts
2. Reducer executes (state updates)
3. Angular runs change detection
4. Components re-render, DOM updates
5. afterNextRender() fires → Timer ends

This captures the full render cycle from action to painted pixels.`,

  status: `Performance Status

• Good (green): ≤ 16ms - Within 60fps frame budget
• Warning (yellow): 16-32ms - May cause occasional jank
• Critical (red): > 32ms - Will cause visible stuttering

The 16ms budget comes from 1000ms ÷ 60fps = 16.67ms per frame.`,
} as const;

@Component({
  selector: 'app-performance-panel',
  imports: [MatCardModule, MatIconModule, MatTableModule, MatButtonModule, MatTooltipModule],
  templateUrl: './performance-panel.component.html',
  styleUrl: './performance-panel.component.scss',
})
export class PerformancePanelComponent implements OnChanges {
  private readonly FRAME_BUDGET_MS = 16;

  @Input() messages: StateChangeMessage[] = [];
  @Input() selectedActionType: string | null = null;

  private entries = signal<RenderEntry[]>([]);

  /** Expose tooltips to template */
  readonly tooltips = METRIC_TOOLTIPS;

  renderStats = computed<RenderStats>(() => {
    const allEntries = this.entries();
    if (!allEntries.length) {
      return { avgRenderTime: 0, maxRenderTime: 0, totalActions: 0 };
    }

    const renderTimes = allEntries.map(e => e.renderTime);

    return {
      avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      totalActions: allEntries.length,
    };
  });

  slowestRenders = computed(() =>
    [...this.entries()]
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, 10)
  );

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.processMessages();
    }
    if (changes['selectedActionType'] && this.selectedActionType) {
      this.scrollToAction(this.selectedActionType);
    }
  }

  private processMessages(): void {
    const entries = this.messages
      .filter((msg): msg is StateChangeMessage & { renderPerformance: RenderPerformance } =>
        msg.type === 'STATE_CHANGE' && !!msg.renderPerformance)
      .map(msg => ({
        actionType: msg.action.type,
        renderTime: msg.renderPerformance.renderTime,
      }));

    this.entries.set(entries);
  }

  private scrollToAction(actionType: string): void {
    setTimeout(() => {
      document
        .querySelector(`[data-action-type="${actionType}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  public formatMs(ms: number): string {
    return `${ms.toFixed(2)}ms`;
  }

  public getRenderStatus(ms: number): 'good' | 'warning' | 'critical' {
    if (ms <= this.FRAME_BUDGET_MS) return 'good';
    if (ms <= this.FRAME_BUDGET_MS * 2) return 'warning';
    return 'critical';
  }

  public getStatusColor(status: 'good' | 'warning' | 'critical'): string {
    return STATUS_COLORS[status];
  }

  public hasPerformanceIssues(): boolean {
    return this.renderStats().maxRenderTime > this.FRAME_BUDGET_MS;
  }

  public openAngularProfiler(): void {
    window.open('https://angular.dev/tools/devtools', '_blank');
  }

  public getOptimizationTips(): { text: string; docUrl?: string }[] {
    const { maxRenderTime } = this.renderStats();
    const tips = OPTIMIZATION_TIPS
      .filter(tip => maxRenderTime > tip.threshold)
      .map(({ text, docUrl }) => ({ text, docUrl }));

    return tips.length ? tips : [{ text: 'Performance looks good!' }];
  }

  public isSelectedAction(actionType: string): boolean {
    return this.selectedActionType === actionType;
  }
}
