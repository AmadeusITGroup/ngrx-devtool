import { Component, Input, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  StateChangeMessage,
  RenderPerformance,
  RenderEntry,
  STATUS_COLORS,
  METRIC_TOOLTIPS,
} from './performance-panel.models';

@Component({
  selector: 'app-performance-panel',
  imports: [
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    TitleCasePipe,
  ],
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

  actionEntries = computed(() =>
    [...this.entries()]
      .sort((a, b) => b.renderTime - a.renderTime)
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
        reducerTime: msg.renderPerformance.reducerTime,
        stateSize: msg.renderPerformance.stateSize,
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
    return `${ms.toFixed(2)} ms`;
  }

  public formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  public getRenderStatus(ms: number): 'good' | 'warning' | 'critical' {
    if (ms <= this.FRAME_BUDGET_MS) return 'good';
    if (ms <= this.FRAME_BUDGET_MS * 2) return 'warning';
    return 'critical';
  }

  public getStatusColor(status: 'good' | 'warning' | 'critical'): string {
    return STATUS_COLORS[status];
  }

  public isSelectedAction(actionType: string): boolean {
    return this.selectedActionType === actionType;
  }
}
