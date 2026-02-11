import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-quick-start',
  standalone: true,
  imports: [],
  templateUrl: './quick-start.html',
  styleUrls: ['./quick-start.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickStart {}
