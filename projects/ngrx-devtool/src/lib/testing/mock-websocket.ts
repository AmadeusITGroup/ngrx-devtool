export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = MockWebSocket.CONNECTING;
  readonly OPEN = MockWebSocket.OPEN;
  readonly CLOSING = MockWebSocket.CLOSING;
  readonly CLOSED = MockWebSocket.CLOSED;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  readonly sentMessages: string[] = [];

  private autoOpen: boolean;

  constructor(url: string, autoOpen = true) {
    this.url = url;
    this.autoOpen = autoOpen;
    if (autoOpen) {
      Promise.resolve().then(() => this.simulateOpen());
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateMessage(data: unknown): void {
    const messageData = typeof data === 'string' ? data : JSON.stringify(data);
    this.onmessage?.(new MessageEvent('message', { data: messageData }));
  }

  simulateError(error: Error): void {
    this.onerror?.(new ErrorEvent('error', { error }));
  }

  send(data: string): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.sentMessages.push(data);
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  getSentMessagesAsObjects<T = unknown>(): T[] {
    return this.sentMessages.map((msg) => JSON.parse(msg) as T);
  }

  clearMessages(): void {
    this.sentMessages.length = 0;
  }
}

export const WebSocketConstants = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

export function installMockWebSocket(autoOpen = true): MockWebSocket {
  const mockWs = new MockWebSocket('ws://localhost:4000', autoOpen);
  const MockWebSocketConstructor = jest.fn(() => mockWs) as unknown as typeof WebSocket;
  Object.assign(MockWebSocketConstructor, WebSocketConstants);
  (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocketConstructor;
  return mockWs;
}

export function restoreWebSocket(original: typeof WebSocket | undefined): void {
  if (original) {
    (global as unknown as { WebSocket: unknown }).WebSocket = original;
  }
}
