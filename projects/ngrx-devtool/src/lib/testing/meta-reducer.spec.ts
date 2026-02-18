import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Action } from '@ngrx/store';
import { PerformanceTrackerService } from '../performance/performance-tracker.service';
import { WebSocketService } from '../core/websocket.service';
import { createDevToolMetaReducer, StateChangeMessage } from '../store/meta-reducer';
import { MockWebSocket, WebSocketConstants } from './mock-websocket';

describe('createDevToolMetaReducer()', () => {
  let performanceTracker: PerformanceTrackerService;
  let webSocketService: WebSocketService;
  let originalWebSocket: typeof WebSocket | undefined;
  let createdWebSockets: MockWebSocket[];

  interface TestState {
    count: number;
  }

  const initialState: TestState = { count: 0 };

  function testReducer(state: TestState = initialState, action: Action): TestState {
    switch (action.type) {
      case '[Counter] Increment':
        return { count: state.count + 1 };
      case '[Counter] Decrement':
        return { count: state.count - 1 };
      case '[Counter] Reset':
        return { count: 0 };
      default:
        return state;
    }
  }

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
        PerformanceTrackerService,
        WebSocketService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    performanceTracker = TestBed.inject(PerformanceTrackerService);
    webSocketService = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    webSocketService.ngOnDestroy();
    if (originalWebSocket) {
      (global as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    } else {
      delete (global as unknown as Record<string, unknown>).WebSocket;
    }
  });

  it('should return a function that returns a reducer function', () => {
    const metaReducerFactory = createDevToolMetaReducer();
    expect(typeof metaReducerFactory).toBe('function');

    const wrappedReducer = TestBed.runInInjectionContext(() =>
      metaReducerFactory(testReducer)
    );
    expect(typeof wrappedReducer).toBe('function');
  });

  it('should pass through reducer state correctly', () => {
    const wrappedReducer = TestBed.runInInjectionContext(() =>
      createDevToolMetaReducer()(testReducer)
    );

    const result = wrappedReducer(initialState, { type: '[Counter] Increment' });

    expect(result).toEqual({ count: 1 });
  });

  it('should handle initial undefined state', () => {
    const wrappedReducer = TestBed.runInInjectionContext(() =>
      createDevToolMetaReducer()(testReducer)
    );

    const result = wrappedReducer(undefined as unknown as TestState, { type: 'INIT' });

    expect(result).toEqual(initialState);
  });

  it('should initialize WebSocket with default URL', () => {
    TestBed.runInInjectionContext(() => {
      createDevToolMetaReducer()(testReducer);
    });

    const ws = createdWebSockets[createdWebSockets.length - 1];
    expect(ws).toBeDefined();
    expect(ws.url).toBe('ws://localhost:4000');
  });

  it('should initialize WebSocket with custom URL string', () => {
    TestBed.runInInjectionContext(() => {
      createDevToolMetaReducer('ws://custom:5000')(testReducer);
    });

    const ws = createdWebSockets[createdWebSockets.length - 1];
    expect(ws.url).toBe('ws://custom:5000');
  });

  it('should accept config object with custom wsUrl', () => {
    TestBed.runInInjectionContext(() => {
      createDevToolMetaReducer({ wsUrl: 'ws://config:6000' })(testReducer);
    });

    const ws = createdWebSockets[createdWebSockets.length - 1];
    expect(ws.url).toBe('ws://config:6000');
  });

  describe('with performance tracking disabled', () => {
    it('should send state change message without performance data', () => {
      const wrappedReducer = TestBed.runInInjectionContext(() =>
        createDevToolMetaReducer({ enablePerformanceTracking: false })(testReducer)
      );

      // Open the WebSocket so messages send directly
      const ws = createdWebSockets[createdWebSockets.length - 1];
      ws.simulateOpen();

      wrappedReducer(initialState, { type: '[Counter] Increment' });

      expect(ws.sentMessages.length).toBe(1);
      const message = JSON.parse(ws.sentMessages[0]) as StateChangeMessage;
      expect(message.type).toBe('STATE_CHANGE');
      expect(message.action.type).toBe('[Counter] Increment');
      expect(message.prevState).toEqual(initialState);
      expect(message.nextState).toEqual({ count: 1 });
      expect(message.renderPerformance).toBeUndefined();
    });
  });

  describe('with performance tracking enabled (default)', () => {
    it('should use performance tracker to measure render time', () => {
      const spy = jest.spyOn(performanceTracker, 'measureRenderTime');

      const wrappedReducer = TestBed.runInInjectionContext(() =>
        createDevToolMetaReducer()(testReducer)
      );

      wrappedReducer(initialState, { type: '[Counter] Increment' });

      expect(spy).toHaveBeenCalledWith(
        '[Counter] Increment',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should still return correct state with performance tracking', () => {
      const wrappedReducer = TestBed.runInInjectionContext(() =>
        createDevToolMetaReducer({ enablePerformanceTracking: true })(testReducer)
      );

      const result = wrappedReducer({ count: 5 }, { type: '[Counter] Decrement' });

      expect(result).toEqual({ count: 4 });
    });
  });

  describe('sequential actions', () => {
    it('should correctly track multiple sequential state changes', () => {
      const wrappedReducer = TestBed.runInInjectionContext(() =>
        createDevToolMetaReducer({ enablePerformanceTracking: false })(testReducer)
      );

      const ws = createdWebSockets[createdWebSockets.length - 1];
      ws.simulateOpen();

      let state = wrappedReducer(initialState, { type: '[Counter] Increment' });
      state = wrappedReducer(state, { type: '[Counter] Increment' });
      state = wrappedReducer(state, { type: '[Counter] Decrement' });

      expect(state).toEqual({ count: 1 });
      expect(ws.sentMessages.length).toBe(3);

      const messages = ws.getSentMessagesAsObjects<StateChangeMessage>();
      expect(messages[0].prevState).toEqual({ count: 0 });
      expect(messages[0].nextState).toEqual({ count: 1 });
      expect(messages[1].prevState).toEqual({ count: 1 });
      expect(messages[1].nextState).toEqual({ count: 2 });
      expect(messages[2].prevState).toEqual({ count: 2 });
      expect(messages[2].nextState).toEqual({ count: 1 });
    });
  });

  describe('message timestamps', () => {
    it('should include an ISO timestamp in each message', () => {
      const wrappedReducer = TestBed.runInInjectionContext(() =>
        createDevToolMetaReducer({ enablePerformanceTracking: false })(testReducer)
      );

      const ws = createdWebSockets[createdWebSockets.length - 1];
      ws.simulateOpen();

      wrappedReducer(initialState, { type: '[Counter] Increment' });

      const message = JSON.parse(ws.sentMessages[0]) as StateChangeMessage;
      expect(message.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
