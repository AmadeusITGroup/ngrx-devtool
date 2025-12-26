import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { WebsocketService } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabChangeEvent, MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { JsonTreeComponent } from '../components/json-tree/json-tree.component';
import { DatePipe } from '@angular/common';
import { DiffViewerComponent } from '../components/diff-viewer/diff-viewer.component';
import { PerformancePanelComponent } from '../components/performance-panel/performance-panel.component';
import { EffectsPanelComponent, EffectEventMessage } from '../components/effects-panel/effects-panel.component';

interface RenderTimingMessage {
  type: 'RENDER_TIMING';
  actionType: string;
  reducerTime: number;
  renderTime: number;
  totalTime: number;
  timestamp: string;
}

interface ActionMessage {
  type: string;
  action?: { type: string };
  effectName?: string;
  isEffectResult?: boolean;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  imports: [
    DatePipe,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatButtonModule,
    JsonTreeComponent,
    DiffViewerComponent,
    PerformancePanelComponent,
    EffectsPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'ngrx-devtool-ui';
  messages = signal<any[]>([]);
  effectEvents = signal<EffectEventMessage[]>([]);
  renderTimings = signal<Map<string, RenderTimingMessage>>(new Map());
  selectedActionType = signal<string | null>(null);

  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;

  // Count of effect executions for tab badge
  effectExecutionsCount = computed(() => {
    const events = this.effectEvents();
    // Count emitted events (each is a complete execution)
    return events.filter(e => e.effectEvent?.lifecycle === 'emitted').length;
  });

  messagesWithPrevState = computed(() => {
    const msgs = this.messages();
    const timings = this.renderTimings();
    const effects = this.effectEvents();

    // Build a map of action types to effect names that emitted them
    const actionToEffect = new Map<string, string>();
    for (const effect of effects) {
      if (effect.effectEvent?.lifecycle === 'emitted' && effect.action) {
        actionToEffect.set(effect.action, effect.effectName || effect.effectEvent.name);
      }
    }

    return msgs.map((msg, index) => {
      const prevState = index > 0 ? msgs[index - 1].nextState : undefined;
      // Find matching render timing by timestamp proximity (within 100ms)
      const timing = timings.get(msg.timestamp);

      // Enrich with effect source if this action was emitted by an effect
      const actionType = msg.action?.type;
      const effectSource = actionType ? actionToEffect.get(actionType) : undefined;

      // Use effect data to determine if this is an effect result
      const isEffectResult = msg.isEffectResult || !!effectSource;

      return {
        ...msg,
        prevState,
        renderTiming: timing,
        // Prefer effect source from actual effect events over heuristics
        effectName: effectSource || msg.effectName,
        isEffectResult,
      };
    });
  });

  hasPerformanceWarnings = computed(() => {
    const msgs = this.messages();
    return msgs.some(m => m.performance?.warnings?.length > 0);
  });

  private subscription?: Subscription;
  private readonly _webSocketService = inject(WebsocketService);

  ngOnInit(): void {
    this._webSocketService.connect('ws://localhost:4000');
    this.subscription = this._webSocketService.messages$?.subscribe((msg) => {
      if (!msg) return; // Skip null messages

      if (msg.type === 'RENDER_TIMING') {
        // Store render timing indexed by action type + approximate timestamp
        this.renderTimings.update(map => {
          const newMap = new Map(map);
          // Find the most recent state change message for this action type
          const msgs = this.messages();
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            if (m.action?.type === msg.actionType && !m.renderTiming) {
              newMap.set(m.timestamp, msg);
              // Update the message with render timing
              this.messages.update(arr => {
                const updated = [...arr];
                updated[i] = { ...updated[i], renderTiming: msg };
                return updated;
              });
              break;
            }
          }
          return newMap;
        });
      } else if (msg.type === 'EFFECT_EVENT') {
        // Store effect events separately for the Effects Panel
        this.effectEvents.update((arr) => [...arr, msg as EffectEventMessage]);
      } else {
        this.messages.update((arr) => [...arr, msg]);
      }
    });
  }
  ngOnDestroy() {
    this._webSocketService.close();
    this.subscription?.unsubscribe();
  }

  onTabChange(event: MatTabChangeEvent, message: any) {
    if (event.index === 2 && !message.diffLoaded && !message.diffLoading) {
      message.diffLoading = true;

      setTimeout(() => {
        message.diffLoaded = true;
        message.diffLoading = false;
      }, 0);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  navigateToPerformance(actionType: string) {
    this.selectedActionType.set(actionType);
    this.tabGroup.selectedIndex = 1; // Switch to Performance tab (0-indexed)
  }
}
