import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { EffectTrackerService, TrackedAction } from '@amadeus-it-group/ngrx-devtool';
import { BooksActions } from '../state/book.actions';

@Component({
  selector: 'app-correlation-debug',
  template: `
    <div class="debug-panel">
      <h2>Correlation Debug Panel</h2>

      <div class="actions-row">
        <button (click)="dispatchBothConcurrently()">
          Dispatch Load + Search concurrently
        </button>
        <button (click)="refreshTimeline()">Refresh Timeline</button>
        <button (click)="clearTimeline()">Clear</button>
      </div>

      <p class="hint">
        Click "Dispatch Load + Search concurrently" to fire two user actions back-to-back.
        Each triggers an async effect.
      </p>

      @if (timeline.length > 0) {
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Action</th>
              <th>Source</th>
              <th>Correlation ID</th>
              <th>Effect Name</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of timeline; track entry.timestamp; let i = $index) {
              <tr [class.effect-row]="entry.source === 'effect'">
                <td>{{ i + 1 }}</td>
                <td>{{ entry.action }}</td>
                <td>
                  <span class="badge" [class.badge-user]="entry.source === 'user'"
                        [class.badge-effect]="entry.source === 'effect'">
                    {{ entry.source }}
                  </span>
                </td>
                <td class="mono">{{ entry.correlationId ?? '—' }}</td>
                <td>{{ entry.effectName ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="empty">No actions tracked yet.</p>
      }
    </div>
  `,
  styles: [],
  standalone: true,
})
export class CorrelationDebugComponent {
  private readonly store = inject(Store);
  private readonly effectTracker = inject(EffectTrackerService);

  timeline: readonly TrackedAction[] = [];

  dispatchBothConcurrently(): void {
    // Fire two user actions back-to-back — each triggers a separate async effect.
    this.store.dispatch(BooksActions.loadBooks());
    this.store.dispatch(BooksActions.searchBooks({ query: 'neuroscience' }));

    // Auto-refresh after effects have time to complete.
    setTimeout(() => this.refreshTimeline(), 2000);
  }

  refreshTimeline(): void {
    this.timeline = this.effectTracker.getTimeline();
  }

  clearTimeline(): void {
    this.effectTracker.clearTimeline();
    this.timeline = [];
  }
}
