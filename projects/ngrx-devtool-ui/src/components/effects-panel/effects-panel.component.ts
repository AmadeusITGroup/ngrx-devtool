import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';

export interface EffectEventMessage {
  type: 'EFFECT_EVENT';
  action?: string;
  effectName?: string;
  effectEvent?: {
    name: string;
    lifecycle: 'triggered' | 'emitted' | 'executed' | 'error';
    duration?: number;
    executionId?: string;
    dispatch?: boolean;
  };
  timestamp: string;
}

export interface EffectExecution {
  effectName: string;
  sourceName: string;
  propertyName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'completed' | 'executed' | 'error';
  triggeredAction?: string;
  emittedAction?: string;
  executionId?: string;
  dispatch?: boolean;
}

@Component({
  selector: 'app-effects-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatBadgeModule,
    MatTabsModule,
  ],
  templateUrl: './effects-panel.component.html',
  styleUrl: './effects-panel.component.scss',
})
export class EffectsPanelComponent {
  @Input() set effectEvents(events: EffectEventMessage[]) {
    this._effectEvents.set(events || []);
  }

  private _effectEvents = signal<EffectEventMessage[]>([]);

  // Group events by effect execution
  // Each 'emitted', 'executed', or 'error' event IS a complete execution
  effectExecutions = computed(() => {
    const events = this._effectEvents();
    const completedExecutions: EffectExecution[] = [];

    for (const event of events) {
      if (!event.effectEvent) continue;

      const effectName = event.effectEvent.name;
      const [sourceName, propertyName] = effectName.split('.');

      if (event.effectEvent.lifecycle === 'emitted') {
        // Dispatching effect emitted an action
        const duration = event.effectEvent.duration || 0;
        completedExecutions.push({
          effectName,
          sourceName: sourceName || 'Unknown',
          propertyName: propertyName || 'unknown',
          startTime: new Date(new Date(event.timestamp).getTime() - duration),
          endTime: new Date(event.timestamp),
          duration: duration,
          status: 'completed',
          emittedAction: event.action,
          executionId: event.effectEvent.executionId,
          dispatch: true,
        });
      } else if (event.effectEvent.lifecycle === 'executed') {
        // Non-dispatching effect executed (dispatch: false)
        const duration = event.effectEvent.duration || 0;
        completedExecutions.push({
          effectName,
          sourceName: sourceName || 'Unknown',
          propertyName: propertyName || 'unknown',
          startTime: new Date(new Date(event.timestamp).getTime() - duration),
          endTime: new Date(event.timestamp),
          duration: duration,
          status: 'executed',
          executionId: event.effectEvent.executionId,
          dispatch: false,
        });
      } else if (event.effectEvent.lifecycle === 'error') {
        // Error is also a complete (failed) execution
        const duration = event.effectEvent.duration || 0;
        completedExecutions.push({
          effectName,
          sourceName: sourceName || 'Unknown',
          propertyName: propertyName || 'unknown',
          startTime: new Date(new Date(event.timestamp).getTime() - duration),
          endTime: new Date(event.timestamp),
          duration: duration,
          status: 'error',
          executionId: event.effectEvent.executionId,
        });
      }
    }

    return {
      running: [],
      completed: completedExecutions.reverse(), // Most recent first
      all: completedExecutions.reverse(),
    };
  });

  // Statistics - effect counts by name
  stats = computed(() => {
    const executions = this.effectExecutions();

    // Group by effect name
    const byEffect = new Map<string, number>();
    for (const exec of executions.all) {
      const count = byEffect.get(exec.effectName) || 0;
      byEffect.set(exec.effectName, count + 1);
    }

    return {
      byEffect: Array.from(byEffect.entries()).map(([name, count]) => ({ name, count })),
    };
  });

  // Unique effect names for the summary view
  uniqueEffects = computed(() => {
    const events = this._effectEvents();
    const effects = new Set<string>();
    for (const event of events) {
      if (event.effectEvent?.name) {
        effects.add(event.effectEvent.name);
      }
    }
    return Array.from(effects);
  });

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return 'check_circle';
      case 'executed': return 'play_circle';
      case 'error': return 'error';
      default: return 'help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'accent';
      case 'executed': return 'primary';
      case 'error': return 'warn';
      default: return '';
    }
  }

  getEffectCount(effectName: string): number {
    const byEffect = this.stats().byEffect;
    const found = byEffect.find(e => e.name === effectName);
    return found?.count || 0;
  }
}
