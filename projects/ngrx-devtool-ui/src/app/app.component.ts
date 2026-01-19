import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { WebsocketService } from '../services/websocket.service';
import { SessionService, RenderTimingMessage } from '../services/session.service';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JsonTreeComponent } from '../components/json-tree/json-tree.component';
import { DatePipe } from '@angular/common';
import { DiffViewerComponent } from '../components/diff-viewer/diff-viewer.component';
import { PerformancePanelComponent, StateChangeMessage } from '../components/performance-panel/performance-panel.component';
import { EffectsPanelComponent, EffectEventMessage } from '../components/effects-panel/effects-panel.component';

/** Enriched message with computed fields for display */
interface EnrichedMessage extends StateChangeMessage {
  prevState: unknown;
  diffLoaded?: boolean;
  diffLoading?: boolean;
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
    MatSnackBarModule,
    JsonTreeComponent,
    DiffViewerComponent,
    PerformancePanelComponent,
    EffectsPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ngrx-devtool-ui';
  messages = signal<StateChangeMessage[]>([]);
  effectEvents = signal<EffectEventMessage[]>([]);
  renderTimings = signal<Map<string, RenderTimingMessage>>(new Map());
  selectedActionType = signal<string | null>(null);
  isImportedSession = signal<boolean>(false);
  importedSessionName = signal<string | null>(null);

  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;

  // Count of effect executions for tab badge
  effectExecutionsCount = computed(() => {
    const events = this.effectEvents();
    // Count emitted events (each is a complete execution)
    return events.filter(e => e.effectEvent?.lifecycle === 'emitted').length;
  });

  messagesWithPrevState = computed<EnrichedMessage[]>(() => {
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
    return msgs.some(m => (m.performance?.warnings?.length ?? 0) > 0);
  });

  private subscription?: Subscription;
  private readonly _webSocketService = inject(WebsocketService);
  private readonly _sessionService = inject(SessionService);
  private readonly _snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this._webSocketService.connect('ws://localhost:4000');
    this.subscription = this._webSocketService.messages$?.subscribe((msg) => {
      if (!msg) return;
      this.handleWebSocketMessage(msg);
    });
  }
  ngOnDestroy() {
    this._webSocketService.close();
    this.subscription?.unsubscribe();
  }

  onTabChange(event: MatTabChangeEvent, message: { diffLoaded?: boolean; diffLoading?: boolean }) {
    if (event.index === 2 && !message.diffLoaded && !message.diffLoading) {
      message.diffLoading = true;

      setTimeout(() => {
        message.diffLoaded = true;
        message.diffLoading = false;
      }, 0);
    }
  }

  formatBytes(bytes: number | undefined): string {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  navigateToPerformance(actionType: string) {
    this.selectedActionType.set(actionType);
    this.tabGroup.selectedIndex = 1; // Switch to Performance tab (0-indexed)
  }

  exportSession(): void {
    const messages = this.messages();
    if (messages.length === 0) {
      this._snackBar.open('No session data to export', 'Close', { duration: 3000 });
      return;
    }

    this._sessionService.exportSession(
      messages,
      this.effectEvents(),
      this.renderTimings()
    );

    this._snackBar.open('Session exported successfully', 'Close', { duration: 3000 });
  }

  async importSession(): Promise<void> {
    try {
      const sessionData = await this._sessionService.importSession();

      // Clear existing data and load imported session
      this.messages.set([...sessionData.messages]);
      this.effectEvents.set([...sessionData.effectEvents]);
      this.renderTimings.set(new Map(sessionData.renderTimings));

      // Mark as imported session
      this.isImportedSession.set(true);
      this.importedSessionName.set(sessionData.appName || null);

      // Disconnect WebSocket since we're viewing an imported session
      this._webSocketService.close();
      this.subscription?.unsubscribe();

      const dateStr = new Date(sessionData.exportedAt).toLocaleString();
      this._snackBar.open(
        `Loaded session from ${dateStr} (${sessionData.messages.length} actions)`,
        'Close',
        { duration: 5000 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import session';
      if (message !== 'File selection cancelled') {
        this._snackBar.open(message, 'Close', { duration: 3000 });
      }
    }
  }

  clearSession(): void {
    this.messages.set([]);
    this.effectEvents.set([]);
    this.renderTimings.set(new Map());
    this.isImportedSession.set(false);
    this.importedSessionName.set(null);

    // Reconnect WebSocket for live data
    this._webSocketService.connect('ws://localhost:4000');
    this.subscription = this._webSocketService.messages$?.subscribe((msg) => {
      if (!msg) return;
      this.handleWebSocketMessage(msg);
    });

    this._snackBar.open('Session cleared', 'Close', { duration: 2000 });
  }

  private handleWebSocketMessage(msg: unknown): void {
    const message = msg as StateChangeMessage & { type: string };

    if (message.type === 'RENDER_TIMING') {
      const renderMsg = msg as RenderTimingMessage;
      this.renderTimings.update(map => {
        const newMap = new Map(map);
        const msgs = this.messages();
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.action?.type === renderMsg.actionType && !m.renderTiming) {
            newMap.set(m.timestamp, renderMsg);
            this.messages.update(arr => {
              const updated = [...arr];
              updated[i] = { ...updated[i], renderTiming: renderMsg };
              return updated;
            });
            break;
          }
        }
        return newMap;
      });
    } else if (message.type === 'EFFECT_EVENT') {
      this.effectEvents.update((arr) => [...arr, msg as EffectEventMessage]);
    } else {
      this.messages.update((arr) => [...arr, message]);
    }
  }
}
