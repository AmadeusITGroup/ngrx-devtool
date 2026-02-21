import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'app-run-locally',
  standalone: true,
  imports: [],
  templateUrl: './run-locally.html',
  styleUrls: ['./run-locally.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RunLocally {
  public runAppCommands = `npm install ngrx-devtool
npx ngrx-devtool`;

  copyCode() {
    navigator.clipboard.writeText(this.runAppCommands);
  }
}
