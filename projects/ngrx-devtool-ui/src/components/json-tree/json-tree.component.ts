import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
export interface JsonTreeNode {
  key: string;
  value?: string | number | boolean | null;
  children?: JsonTreeNode[];
}
@Component({
  selector: 'app-json-tree',
  imports: [],
  templateUrl: './json-tree.component.html',
  styleUrl: './json-tree.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class JsonTreeComponent{
  @Input() jsonData: unknown;
}
