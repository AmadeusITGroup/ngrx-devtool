import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-common-issues',
  standalone: true,
  templateUrl: './common-issues.html',
  styleUrls: ['./common-issues.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommonIssues {}
