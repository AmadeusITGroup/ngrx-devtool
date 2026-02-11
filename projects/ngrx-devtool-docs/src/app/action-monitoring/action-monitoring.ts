import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-action-monitoring',
  standalone: true,
  imports: [],
  templateUrl: './action-monitoring.html',
  styleUrls: ['./action-monitoring.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionMonitoring {}
