import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  templateUrl: './diff-viewer.html',
  styleUrls: ['./diff-viewer.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiffViewer {}
