import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { DEFAULT_WS_URL } from './core.models';

export interface WebSocketMessage {
  readonly type: string;
}

const MAX_BUFFER_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private socket: WebSocket | null = null;
  private messageBuffer: string[] = [];
  private wsUrl: string | null = null;
  private initialized = false;

  private readonly connectionState$ = new BehaviorSubject<boolean>(false);
  private readonly incomingMessages$ = new BehaviorSubject<WebSocketMessage | null>(null);

  get isConnected(): boolean {
    return this.connectionState$.getValue();
  }

  get connected$(): Observable<boolean> {
    return this.connectionState$.asObservable();
  }

  get messages$(): Observable<WebSocketMessage | null> {
    return this.incomingMessages$.asObservable();
  }

  initialize(wsUrl = DEFAULT_WS_URL): void {
    if (this.initialized) {
      // If already initialized with same URL, skip
      if (this.wsUrl === wsUrl) {
        return;
      }
      // If different URL, close existing and reinitialize
      this.close();
    }

    this.initialized = true;
    this.wsUrl = wsUrl;
    this.setupWebSocket(wsUrl);
  }

  send<T extends WebSocketMessage>(message: T): void {
    this.bufferOrSend(JSON.stringify(message));
  }

  sendRaw(payload: string): void {
    this.bufferOrSend(payload);
  }

  private bufferOrSend(payload: string): void {
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    } else if (this.isBrowser && this.messageBuffer.length < MAX_BUFFER_SIZE) {
      this.messageBuffer.push(payload);
    }
  }

  ngOnDestroy(): void {
    this.close();
    this.connectionState$.complete();
    this.incomingMessages$.complete();
  }

  private close(): void {
    this.socket?.close();
    this.socket = null;
    this.messageBuffer = [];
    this.connectionState$.next(false);
    this.initialized = false;
    this.wsUrl = null;
  }

  private setupWebSocket(wsUrl: string): void {
    if (!this.isBrowser) {
      return;
    }

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.connectionState$.next(true);
      this.flushBuffer();
    };

    this.socket.onclose = () => {
      this.connectionState$.next(false);
    };

    this.socket.onerror = (error) => {
      console.warn('[NgRx DevTool] WebSocket error:', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.incomingMessages$.next(message);
      } catch {
        // Ignore non-JSON messages
      }
    };
  }

  private flushBuffer(): void {
    const buffered = this.messageBuffer;
    this.messageBuffer = [];

    for (const message of buffered) {
      if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(message);
      }
    }
  }
}
