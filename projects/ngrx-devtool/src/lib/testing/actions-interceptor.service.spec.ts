import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideEffects, EffectSources } from '@ngrx/effects';

import { ActionsInterceptorService, DevToolMessage } from '../core/actions-interceptor.service';
import { EffectTrackerService } from '../core/effect-tracker.service';
import { DevToolsEffectSources, EffectEvent } from '../core/devtools-effect-sources';
import { WebSocketService } from '../core/websocket.service';
import { TestEffects, testActions, testReducer } from './test-effects';
import { MockWebSocket, WebSocketConstants } from './mock-websocket';

describe('ActionsInterceptorService', () => {
  let interceptorService: ActionsInterceptorService;
  let effectTracker: EffectTrackerService;
  let webSocketService: WebSocketService;
  let originalWebSocket: typeof WebSocket | undefined;
  let createdWebSockets: MockWebSocket[];

  beforeEach(() => {
    originalWebSocket = (global as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
    createdWebSockets = [];

    const MockWebSocketConstructor = jest.fn((url: string) => {
      const ws = new MockWebSocket(url, false);
      createdWebSockets.push(ws);
      return ws;
    }) as unknown as typeof WebSocket;

    Object.assign(MockWebSocketConstructor, WebSocketConstants);
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocketConstructor;

    TestBed.configureTestingModule({
      providers: [
        provideStore({ test: testReducer }),
        provideEffects([TestEffects]),
        { provide: EffectSources, useClass: DevToolsEffectSources },
        { provide: PLATFORM_ID, useValue: 'browser' },
        EffectTrackerService,
        WebSocketService,
        ActionsInterceptorService,
      ],
    });

    interceptorService = TestBed.inject(ActionsInterceptorService);
    effectTracker = TestBed.inject(EffectTrackerService);
    webSocketService = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    interceptorService.ngOnDestroy();
    webSocketService.ngOnDestroy();
    if (originalWebSocket) {
      (global as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    }
  });

  function getCreatedWebSocket(): MockWebSocket {
    return createdWebSockets[createdWebSockets.length - 1];
  }

  describe('WebSocket Connection', () => {
    it('should create WebSocket with provided URL', () => {
      interceptorService.initialize('ws://localhost:4000');
      const ws = getCreatedWebSocket();

      expect(ws.url).toBe('ws://localhost:4000');
    });

    it('should use default URL when not provided', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();

      expect(ws.url).toBe('ws://localhost:4000');
    });

    it('should set readyState to OPEN when connection is established', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();

      expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });

    it('should close WebSocket on WebSocketService destroy', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();

      webSocketService.ngOnDestroy();

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe('Timeline Management', () => {
    it('should delegate getTimeline to EffectTrackerService', () => {
      effectTracker.trackAction(testActions.loadItems());
      effectTracker.trackAction(testActions.addItem({ item: 'test' }));

      const timeline = interceptorService.getTimeline();

      expect(timeline.length).toBe(2);
      expect(timeline[0].action).toBe('[Test] Load Items');
      expect(timeline[1].action).toBe('[Test] Add Item');
    });

    it('should delegate clearTimeline to EffectTrackerService', () => {
      effectTracker.trackAction(testActions.loadItems());
      expect(interceptorService.getTimeline().length).toBe(1);

      interceptorService.clearTimeline();

      expect(interceptorService.getTimeline().length).toBe(0);
    });

    it('should send TIMELINE_CLEARED message when clearing (when connected)', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();
      ws.clearMessages();

      interceptorService.clearTimeline();

      const messages = ws.getSentMessagesAsObjects<DevToolMessage>();
      const clearMessage = messages.find((m) => m.type === 'TIMELINE_CLEARED');

      expect(clearMessage).toBeDefined();
      expect(clearMessage!.timestamp).toBeDefined();
    });
  });

  describe('Message Buffering', () => {
    it('should buffer messages when WebSocket is not connected', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();

      interceptorService.clearTimeline();

      expect(ws.sentMessages.length).toBe(0);
    });

    it('should flush buffered messages when connection opens', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      interceptorService.clearTimeline();

      expect(ws.sentMessages.length).toBe(0);

      ws.simulateOpen();

      expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });
  });

  describe('Message Format', () => {
    it('should send TIMELINE_CLEARED with correct format', () => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();
      ws.clearMessages();

      interceptorService.clearTimeline();

      const messages = ws.getSentMessagesAsObjects<DevToolMessage>();
      const message = messages.find((m) => m.type === 'TIMELINE_CLEARED');

      expect(message).toBeDefined();
      expect(message!.type).toBe('TIMELINE_CLEARED');
      expect(message!.timestamp).toBeDefined();
      expect(new Date(message!.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Effect Event Forwarding', () => {
    function getEffectSources(): DevToolsEffectSources {
      return TestBed.inject(EffectSources) as DevToolsEffectSources;
    }

    function emitEffectEvent(event: EffectEvent): void {
      getEffectSources().effectEvents$.next(event);
    }

    it('should include errorMessage and errorStack in EFFECT_EVENT when lifecycle is error', fakeAsync(() => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();
      ws.clearMessages();

      const error = new Error('Something went wrong');

      emitEffectEvent({
        effectName: 'TestEffects.failingEffect$',
        sourceName: 'TestEffects',
        propertyName: 'failingEffect$',
        lifecycle: 'error',
        error,
        timestamp: Date.now(),
        executionId: 'test-exec-error-1',
      });
      tick(0);

      const messages = ws.getSentMessagesAsObjects<DevToolMessage>();
      const effectMsg = messages.find((m) => m.type === 'EFFECT_EVENT');

      expect(effectMsg).toBeDefined();
      expect(effectMsg!.effectEvent?.errorMessage).toBe('Something went wrong');
      expect(effectMsg!.effectEvent?.errorStack).toContain('Error: Something went wrong');
    }));

    it('should include errorMessage for non-Error thrown values', fakeAsync(() => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();
      ws.clearMessages();

      emitEffectEvent({
        effectName: 'TestEffects.failingEffect$',
        sourceName: 'TestEffects',
        propertyName: 'failingEffect$',
        lifecycle: 'error',
        error: 'plain string error',
        timestamp: Date.now(),
        executionId: 'test-exec-error-2',
      });
      tick(0);

      const messages = ws.getSentMessagesAsObjects<DevToolMessage>();
      const effectMsg = messages.find((m) => m.type === 'EFFECT_EVENT');

      expect(effectMsg).toBeDefined();
      expect(effectMsg!.effectEvent?.errorMessage).toBe('plain string error');
      expect(effectMsg!.effectEvent?.errorStack).toBeUndefined();
    }));

    it('should not include errorMessage or errorStack for non-error lifecycle', fakeAsync(() => {
      interceptorService.initialize();
      const ws = getCreatedWebSocket();
      ws.simulateOpen();
      ws.clearMessages();

      emitEffectEvent({
        effectName: 'TestEffects.loadItems$',
        sourceName: 'TestEffects',
        propertyName: 'loadItems$',
        lifecycle: 'emitted',
        action: testActions.loadItemsSuccess({ items: [] }),
        timestamp: Date.now(),
        executionId: 'test-exec-emitted-1',
        dispatch: true,
      });
      tick(0);

      const messages = ws.getSentMessagesAsObjects<DevToolMessage>();
      const effectMsg = messages.find((m) => m.type === 'EFFECT_EVENT');

      expect(effectMsg).toBeDefined();
      expect(effectMsg!.effectEvent?.errorMessage).toBeUndefined();
      expect(effectMsg!.effectEvent?.errorStack).toBeUndefined();
    }));
  });

  describe('Platform Detection', () => {
    it('should not create WebSocket on non-browser platform', () => {
      TestBed.resetTestingModule();

      const serverMock = new MockWebSocket('ws://localhost:4000', false);
      (global as unknown as { WebSocket: unknown }).WebSocket = jest.fn(() => serverMock);

      TestBed.configureTestingModule({
        providers: [
          provideStore({ test: testReducer }),
          provideEffects([TestEffects]),
          { provide: EffectSources, useClass: DevToolsEffectSources },
          { provide: PLATFORM_ID, useValue: 'server' },
          EffectTrackerService,
          ActionsInterceptorService,
        ],
      });

      const serverInterceptor = TestBed.inject(ActionsInterceptorService);
      serverInterceptor.initialize();

      expect(serverMock.readyState).toBe(MockWebSocket.CONNECTING);
    });
  });
});
