import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  // CUSTOM_ELEMENTS_SCHEMA, // 3D model commented out for now
} from '@angular/core';
import { RouterLink } from '@angular/router';
// import '@google/model-viewer'; // 3D model commented out for now

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  // schemas: [CUSTOM_ELEMENTS_SCHEMA], // 3D model commented out for now
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home {}
