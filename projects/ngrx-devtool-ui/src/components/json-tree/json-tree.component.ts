import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, Input, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface JsonTreeNode {
  key: string;
  value?: string | number | boolean | null;
  children?: JsonTreeNode[];
}

@Component({
  selector: 'app-json-tree',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './json-tree.component.html',
  styleUrl: './json-tree.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class JsonTreeComponent {
  @Input() jsonData: unknown;

  @ViewChild('jsonViewer', { static: false })
  jsonViewerRef!: ElementRef;

  expanded = false;

  private readonly ITEM_THRESHOLD = 5;

  get showToggle(): boolean {
    return this.countItems(this.jsonData) > this.ITEM_THRESHOLD;
  }

  private countItems(data: unknown, depth = 0): number {
    if (data === null || data === undefined || typeof data !== 'object') {
      return 0;
    }
    const entries = Array.isArray(data) ? data : Object.values(data);
    let count = entries.length;
    for (const value of entries) {
      if (typeof value === 'object' && value !== null) {
        count += this.countItems(value, depth + 1);
      }
    }
    return count;
  }

  toggle(): void {
    const viewer = this.jsonViewerRef?.nativeElement;
    if (!viewer) return;

    this.expanded = !this.expanded;
    if (this.expanded && typeof viewer.expandAll === 'function') {
      viewer.expandAll();
    } else if (!this.expanded && typeof viewer.collapseAll === 'function') {
      viewer.collapseAll();
    }
  }
}
