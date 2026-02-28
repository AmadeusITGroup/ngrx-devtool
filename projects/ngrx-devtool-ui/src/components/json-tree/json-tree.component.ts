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
