import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { from, map, mergeMap, Observable, of, filter } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { readBlobAsText } from '../util/helpers';
import { isPlatformBrowser } from '@angular/common';
@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private socket$?: WebSocketSubject<unknown>;
  public messages$?: Observable<unknown>;
  private isBrowser: boolean;
  private readonly platformId = inject(PLATFORM_ID);
  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  connect(url: string): void {
    if (!this.isBrowser) {
      console.warn('WebSocket is only available in the browser');
      this.messages$ = of([]);
      return;
    }
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket({url, deserializer: (e) => e.data});
      this.messages$ = this.socket$.pipe(
        mergeMap(data => {
          if (data instanceof Blob) {
            return from(readBlobAsText(data)).pipe(
              map(text => {
                try {
                  const parsed = JSON.parse(text);
                  return parsed;
                } catch {
                  return null;
                }
              })
            );
          }
          // Data is a string - parse it as JSON
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              return of(parsed);
            } catch {
              return of(null);
            }
          }
          // Data is already an object
          return of(data);
        }),
        filter(msg => msg !== null) // Filter out null messages
      );
    }
  }

  send(message: unknown): void {
    if (this.socket$ && !this.socket$.closed) {
      this.socket$.next(message);
    }
  }

  close(): void {
    this.socket$?.complete();
    this.socket$ = undefined;
    this.messages$ = undefined;
  }
}
