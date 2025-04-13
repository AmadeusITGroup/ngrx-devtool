import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgrxDevtoolComponent } from 'ngrx-devtool';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'ngrx-devtool-demo';
}
