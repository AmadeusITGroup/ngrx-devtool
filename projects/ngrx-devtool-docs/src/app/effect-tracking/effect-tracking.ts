import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-effect-tracking',
  standalone: true,
  templateUrl: './effect-tracking.html',
  styleUrls: ['./effect-tracking.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EffectTracking {}
