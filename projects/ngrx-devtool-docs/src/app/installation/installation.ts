import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'app-installation',
  standalone: true,
  imports: [],
  templateUrl: './installation.html',
  styleUrls: ['./installation.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Installation {}
