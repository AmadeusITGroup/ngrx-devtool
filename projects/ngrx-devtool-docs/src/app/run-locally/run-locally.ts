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
  public runAppCommands = `git clone https://github.com/amadeusitgroup/ngrx-devtool
cd ngrx-devtool
npm install
npm run build
node dist/index.js`;

  copyCode() {
    navigator.clipboard.writeText(this.runAppCommands);
  }
}
