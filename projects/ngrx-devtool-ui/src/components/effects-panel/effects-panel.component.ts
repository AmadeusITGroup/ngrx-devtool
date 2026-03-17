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

import { EffectEventMessage, EffectExecution } from './effects-panel.models';

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

      const { name, lifecycle, duration: rawDuration, executionId } = event.effectEvent;
      const [sourceName, propertyName] = name.split('.');
      const duration = rawDuration || 0;

      // Only process terminal lifecycle states
      if (lifecycle !== 'emitted' && lifecycle !== 'executed' && lifecycle !== 'error') {
        continue;
      }

      // Base execution object with shared properties
      const baseExecution = {
        effectName: name,
        sourceName: sourceName || 'Unknown',
        propertyName: propertyName || 'unknown',
        startTime: new Date(new Date(event.timestamp).getTime() - duration),
        endTime: new Date(event.timestamp),
        duration,
        executionId,
      };

      // Lifecycle-specific properties
      const lifecycleProps = {
        emitted: { status: 'completed' as const, emittedAction: event.action, dispatch: true },
        executed: { status: 'executed' as const, dispatch: false },
        error: {
          status: 'error' as const,
          errorMessage: event.effectEvent.errorMessage,
          errorStack: event.effectEvent.errorStack,
        },
      };

      completedExecutions.push({
        ...baseExecution,
        ...lifecycleProps[lifecycle],
      });
    }

    // Reverse once to get most recent first
    const reversed = completedExecutions.reverse();

    return {
      running: [],
      completed: reversed,
      all: reversed,
    };
  });

  // Statistics effect counts by name
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
