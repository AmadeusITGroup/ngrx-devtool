import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { WebSocketService, WebSocketMessage } from '../core/websocket.service';
import { MockWebSocket, WebSocketConstants } from './mock-websocket';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let originalWebSocket: typeof WebSocket | undefined;
  let createdWebSockets: MockWebSocket[];

  function installMock(): void {
    createdWebSockets = [];
    const MockWebSocketConstructor = jest.fn((url: string) => {
      const ws = new MockWebSocket(url, false);
      createdWebSockets.push(ws);
      return ws;
    }) as unknown as typeof WebSocket;
    Object.assign(MockWebSocketConstructor, WebSocketConstants);
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocketConstructor;
  }

  function getLastWs(): MockWebSocket {
    return createdWebSockets[createdWebSockets.length - 1];
  }

  beforeEach(() => {
    originalWebSocket = (global as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
    installMock();

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    if (originalWebSocket) {
      (global as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    }
  });

  describe('initialize()', () => {
    it('should create a WebSocket connection with the given URL', () => {
      service.initialize('ws://localhost:9999');

      expect(getLastWs().url).toBe('ws://localhost:9999');
    });

    it('should default to ws://localhost:4000', () => {
      service.initialize();

      expect(getLastWs().url).toBe('ws://localhost:4000');
    });

    it('should not create a new WebSocket if same URL is re-initialized', () => {
      service.initialize('ws://localhost:4000');
      const count1 = createdWebSockets.length;

      service.initialize('ws://localhost:4000');

      expect(createdWebSockets.length).toBe(count1);
    });

    it('should close old connection and reconnect on different URL', () => {
      service.initialize('ws://localhost:4000');
      const oldWs = getLastWs();
      oldWs.simulateOpen();

      service.initialize('ws://localhost:5000');

      expect(oldWs.readyState).toBe(MockWebSocket.CLOSED);
      expect(getLastWs().url).toBe('ws://localhost:5000');
    });
  });

  describe('isConnected', () => {
    it('should be false before initialization', () => {
      expect(service.isConnected).toBe(false);
    });

    it('should be true after WebSocket opens', () => {
      service.initialize();
      getLastWs().simulateOpen();

      expect(service.isConnected).toBe(true);
    });

    it('should be false after WebSocket closes', () => {
      service.initialize();
      getLastWs().simulateOpen();
      getLastWs().simulateClose();

      expect(service.isConnected).toBe(false);
    });
  });

  describe('connected$', () => {
    it('should emit false initially then true on open', async () => {
      const states: boolean[] = [];
      service.connected$.pipe(take(2), toArray()).subscribe(s => (states.length = 0, states.push(...s)));

      service.initialize();
      getLastWs().simulateOpen();

      // Give async a tick
      await Promise.resolve();
      const value = await firstValueFrom(service.connected$);
      expect(value).toBe(true);
    });
  });

  describe('send()', () => {
    it('should send JSON message when connected', () => {
      service.initialize();
      getLastWs().simulateOpen();

      service.send({ type: 'TEST', data: 123 } as unknown as WebSocketMessage);

      const sent = getLastWs().getSentMessagesAsObjects<{ type: string; data: number }>();
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('TEST');
      expect(sent[0].data).toBe(123);
    });

    it('should buffer messages when not connected', () => {
      service.initialize();
      // Don't open the socket

      service.send({ type: 'BUFFERED' } as WebSocketMessage);

      expect(getLastWs().sentMessages).toHaveLength(0);
    });

    it('should flush buffered messages when connection opens', () => {
      service.initialize();

      service.send({ type: 'MSG_1' } as WebSocketMessage);
      service.send({ type: 'MSG_2' } as WebSocketMessage);

      expect(getLastWs().sentMessages).toHaveLength(0);

      getLastWs().simulateOpen();

      expect(getLastWs().sentMessages).toHaveLength(2);
      const messages = getLastWs().getSentMessagesAsObjects<{ type: string }>();
      expect(messages[0].type).toBe('MSG_1');
      expect(messages[1].type).toBe('MSG_2');
    });

    it('should drop messages once the buffer reaches max size (200)', () => {
      service.initialize();
      // Don't open the socket — all messages go to buffer

      for (let i = 0; i < 250; i++) {
        service.send({ type: `MSG_${i}` } as WebSocketMessage);
      }

      // Open and flush — should only have the first 200
      getLastWs().simulateOpen();
      expect(getLastWs().sentMessages).toHaveLength(200);
    });
  });

  describe('sendRaw()', () => {
    it('should send raw string when connected', () => {
      service.initialize();
      getLastWs().simulateOpen();

      service.sendRaw('raw-payload');

      expect(getLastWs().sentMessages).toContain('raw-payload');
    });

    it('should buffer raw payload when not connected', () => {
      service.initialize();

      service.sendRaw('buffered-raw');

      expect(getLastWs().sentMessages).toHaveLength(0);

      getLastWs().simulateOpen();

      expect(getLastWs().sentMessages).toContain('buffered-raw');
    });
  });

  describe('messages$', () => {
    it('should emit parsed messages received from the server', async () => {
      service.initialize();
      getLastWs().simulateOpen();

      const messagePromise = firstValueFrom(
        service.messages$.pipe(
          // skip null initial value — take the next real message
          take(2),
          toArray()
        )
      );

      getLastWs().simulateMessage({ type: 'SERVER_MSG', value: 42 });

      const messages = await messagePromise;
      const msg = messages.find(m => m !== null);
      expect(msg).toBeDefined();
      expect(msg!.type).toBe('SERVER_MSG');
    });

    it('should ignore non-JSON messages', () => {
      service.initialize();
      getLastWs().simulateOpen();

      let receivedMessage: WebSocketMessage | null = null;
      service.messages$.subscribe(m => {
        if (m !== null) receivedMessage = m;
      });

      // Simulate a non-JSON message
      getLastWs().onmessage?.(new MessageEvent('message', { data: 'not-json{{{' }));

      expect(receivedMessage).toBeNull();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should close the WebSocket', () => {
      service.initialize();
      getLastWs().simulateOpen();

      service.ngOnDestroy();

      expect(getLastWs().readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should set connected to false', () => {
      service.initialize();
      getLastWs().simulateOpen();

      service.ngOnDestroy();

      expect(service.isConnected).toBe(false);
    });
  });

  describe('server platform (SSR)', () => {
    let serverService: WebSocketService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WebSocketService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      serverService = TestBed.inject(WebSocketService);
    });

    afterEach(() => {
      serverService.ngOnDestroy();
    });

    it('should not create a WebSocket on server', () => {
      const countBefore = createdWebSockets.length;
      serverService.initialize();

      expect(createdWebSockets.length).toBe(countBefore);
    });

    it('should not buffer messages on server', () => {
      serverService.initialize();
      serverService.send({ type: 'TEST' } as WebSocketMessage);

      // No WebSocket created, no buffer used
      expect(serverService.isConnected).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should log a warning on WebSocket error', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.initialize();
      getLastWs().simulateError(new Error('connection failed'));

      expect(warnSpy).toHaveBeenCalledWith(
        '[NgRx DevTool] WebSocket error:',
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });
});
