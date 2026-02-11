import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-state-visualization',
  standalone: true,
  templateUrl: './state-visualization.html',
  styleUrls: ['./state-visualization.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StateVisualization {}
