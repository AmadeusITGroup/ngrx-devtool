import { Component, inject, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DiffService, DiffItem, DiffResult } from '../../services/diff.service';

@Component({
  selector: 'app-diff-viewer',
  imports: [CommonModule, ScrollingModule],
  templateUrl: './diff-viewer.component.html',
  styleUrls: ['./diff-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiffViewerComponent implements OnChanges {
  @Input() previousState: any;
  @Input() currentState: any;

  diffs: DiffItem[] = [];
  truncated = false;
  totalChanges = 0;

  private readonly diffService = inject(DiffService);

  ngOnChanges(): void {
    if (this.previousState !== undefined || this.currentState !== undefined) {
      const result = this.diffService.calculateDiff(this.previousState, this.currentState);
      this.diffs = result.diffs;
      this.truncated = result.truncated;
      this.totalChanges = result.totalChanges;
    }
  }

  formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      const str = JSON.stringify(value, null, 2);
      // Truncate very long values
      if (str.length > 500) {
        return str.substring(0, 500) + '... [truncated]';
      }
      return str;
    }
    return String(value);
  }

  trackByPath(index: number, diff: DiffItem): string {
    return diff.path;
  }
}
