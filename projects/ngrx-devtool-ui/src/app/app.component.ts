import { Component, OnInit, signal, computed } from '@angular/core';
import { WebsocketService } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { JsonTreeComponent } from '../components/json-tree/json-tree.component';
import { DatePipe } from '@angular/common';
@Component({
  selector: 'app-root',
  imports: [
    DatePipe,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatTabsModule,
    JsonTreeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'ngrx-devtool-ui';
  messages = signal<any[]>([]);
  private subscription?: Subscription;
  constructor(private _webSocketService: WebsocketService) {}
  ngOnInit(): void {
    this._webSocketService.connect('ws://localhost:4000');
    this.subscription = this._webSocketService.messages$?.subscribe((msg) =>
      this.messages.update((arr) => [...arr, msg])
    );
  }
  ngOnDestroy() {
    this._webSocketService.close();
    this.subscription?.unsubscribe();
  }
}
