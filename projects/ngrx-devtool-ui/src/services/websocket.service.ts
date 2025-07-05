import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { from, map, mergeMap, Observable, of } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { readBlobAsText } from '../util/helpers';
import { isPlatformBrowser } from '@angular/common';
@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private socket$?: WebSocketSubject<any>;
  public messages$?: Observable<any>;
  private isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  connect(url: string): void {
    // Create a websocket if the platform is a browser
    if (!this.isBrowser) {
      console.warn('WebSocket is only available in the browser');
      this.messages$ = of([]);
      return;
    }
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket({url, deserializer: (e) => e.data});
      this.messages$ = this.socket$.pipe(
        mergeMap(data => {
          if (data instanceof Blob){
            return from(readBlobAsText(data)).pipe(
              map(text => {
                try {
                  return JSON.parse(text);
                }
                catch (e) {
                  return text;
                }
              })
            )
          }
          return from(data)
        })
      );
    }
  }
  close(): void {
    this.socket$?.complete();
    this.socket$ = undefined;
    this.messages$ = undefined;
  }
}
