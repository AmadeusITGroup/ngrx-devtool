import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiffService } from '../../services/diff.service';

@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diff-viewer.component.html',
  styleUrls: ['./diff-viewer.component.scss']
})
export class DiffViewerComponent implements OnChanges {
  @Input() previousState: any;
  @Input() currentState: any;
  
  diffs: any[] = [];

  constructor(private diffService: DiffService) {}

  ngOnChanges(): void {
    if (this.previousState !== undefined || this.currentState !== undefined) {
      this.diffs = this.diffService.calculateDiff(this.previousState, this.currentState);
    }
  }

  formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }
}