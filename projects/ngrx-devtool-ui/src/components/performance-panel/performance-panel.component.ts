import { Component, Input, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

interface RenderPerformance {
  totalRenderTime: number;
}

interface StateChangeMessage {
  type: string;
  action: { type: string };
  renderPerformance?: RenderPerformance;
}

interface RenderEntry {
  actionType: string;
  totalRenderTime: number;
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

@Component({
  selector: 'app-performance-panel',
  imports: [MatCardModule, MatIconModule, MatTableModule, MatButtonModule],
  templateUrl: './performance-panel.component.html',
  styleUrl: './performance-panel.component.scss',
})
export class PerformancePanelComponent implements OnChanges {
  private readonly FRAME_BUDGET_MS = 16;

  @Input() messages: StateChangeMessage[] = [];
  @Input() selectedActionType: string | null = null;

  private entries = signal<RenderEntry[]>([]);

  renderStats = computed<RenderStats>(() => {
    const allEntries = this.entries();
    if (!allEntries.length) {
      return { avgRenderTime: 0, maxRenderTime: 0, totalActions: 0 };
    }

    const renderTimes = allEntries.map(e => e.totalRenderTime);
    return {
      avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      totalActions: allEntries.length,
    };
  });

  slowestRenders = computed(() =>
    [...this.entries()]
      .sort((a, b) => b.totalRenderTime - a.totalRenderTime)
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
        totalRenderTime: msg.renderPerformance.totalRenderTime,
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
