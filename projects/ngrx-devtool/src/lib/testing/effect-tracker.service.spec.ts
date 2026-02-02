import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Store, provideStore } from '@ngrx/store';
import { provideEffects, EffectSources } from '@ngrx/effects';

import { EffectTrackerService } from '../core/effect-tracker.service';
import { DevToolsEffectSources, EffectEvent } from '../core/devtools-effect-sources';
import { TestEffects, testActions, testReducer } from './test-effects';

describe('EffectTrackerService', () => {
  let store: Store;
  let trackerService: EffectTrackerService;
  let collectedEffectEvents: EffectEvent[];

  beforeEach(() => {
    collectedEffectEvents = [];

    TestBed.configureTestingModule({
      providers: [
        provideStore({ test: testReducer }),
        provideEffects([TestEffects]),
        { provide: EffectSources, useClass: DevToolsEffectSources },
        EffectTrackerService,
      ],
    });

    store = TestBed.inject(Store);
    trackerService = TestBed.inject(EffectTrackerService);

    trackerService.effectEvents$.subscribe((event) => {
      collectedEffectEvents.push(event);
    });
  });

  afterEach(() => {
    collectedEffectEvents = [];
    trackerService.clearTimeline();
  });

  describe('Action Tracking', () => {
    it('should track a dispatched action', () => {
      const action = testActions.loadItems();
      const tracked = trackerService.trackAction(action);

      expect(tracked.action).toBe('[Test] Load Items');
      expect(tracked.source).toBe('user');
      expect(tracked.timestamp).toBeDefined();
      expect(tracked.correlationId).toBeDefined();
    });

    it('should identify user-dispatched actions vs effect-dispatched actions', fakeAsync(() => {
      const userAction = testActions.loadItems();
      trackerService.trackAction(userAction);

      store.dispatch(userAction);
      tick(100);

      const timeline = trackerService.getTimeline();

      const trackedUserAction = timeline.find((t) => t.action === '[Test] Load Items');
      expect(trackedUserAction).toBeDefined();
      expect(trackedUserAction!.source).toBe('user');
    }));

    it('should maintain action order in timeline', () => {
      trackerService.trackAction(testActions.loadItems());
      trackerService.trackAction(testActions.addItem({ item: 'item1' }));

      const timeline = trackerService.getTimeline();

      expect(timeline.length).toBe(2);

      const timestamps = timeline.map((t) => t.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should include payload in tracked action', () => {
      const action = testActions.addItem({ item: 'test-item' });
      const tracked = trackerService.trackAction(action);

      expect(tracked.payload).toEqual(action);
    });
  });

  describe('Correlation Tracking', () => {
    it('should create correlation ID for user actions', () => {
      const action = testActions.loadItems();
      const tracked = trackerService.trackAction(action);

      expect(tracked.correlationId).toBeDefined();
      expect(tracked.correlationId).toContain('corr_');
    });

    it('should link effect actions to their trigger action via correlation', fakeAsync(() => {
      const userTracked = trackerService.trackAction(testActions.loadItems());

      store.dispatch(testActions.loadItems());
      tick(100);

      const tracked2 = trackerService.trackAction(testActions.loadItems());

      expect(userTracked.correlationId).toBeDefined();
      expect(tracked2.correlationId).toBeDefined();
      expect(userTracked.correlationId).not.toBe(tracked2.correlationId);
    }));
  });

  describe('Effect Events Forwarding', () => {
    it('should forward effect events from DevToolsEffectSources', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(100);

      expect(collectedEffectEvents.length).toBeGreaterThan(0);

      const emittedEvent = collectedEffectEvents.find((e) => e.lifecycle === 'emitted');
      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.effectName).toContain('loadItems$');
    }));
  });

  describe('Timeline Management', () => {
    it('should return immutable timeline copy', () => {
      trackerService.trackAction(testActions.loadItems());

      const timeline1 = trackerService.getTimeline();
      const timeline2 = trackerService.getTimeline();

      expect(timeline1).not.toBe(timeline2);
      expect(timeline1).toEqual(timeline2);
    });

    it('should clear timeline', () => {
      trackerService.trackAction(testActions.loadItems());
      trackerService.trackAction(testActions.addItem({ item: 'test' }));

      expect(trackerService.getTimeline().length).toBe(2);

      trackerService.clearTimeline();

      expect(trackerService.getTimeline().length).toBe(0);
    });

    it('should trim timeline when it exceeds max size', () => {
      for (let i = 0; i < 1010; i++) {
        trackerService.trackAction(testActions.addItem({ item: `item-${i}` }));
      }

      const timeline = trackerService.getTimeline();
      expect(timeline.length).toBeLessThanOrEqual(510);
    });
  });

  describe('Effect Action Detection', () => {
    it('should detect actions dispatched by effects', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(50);

      expect(trackerService.isEffectAction('[Test] Load Items Success')).toBe(true);
    }));

    it('should not detect user actions as effect actions', () => {
      expect(trackerService.isEffectAction('[Test] Load Items')).toBe(false);
    });
  });

  describe('Effect Name Resolution', () => {
    it('should track effect name when effect action type is registered', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(100);

      trackerService.trackAction(testActions.loadItemsSuccess({ items: [] }));

      expect(trackerService.isEffectAction('[Test] Load Items Success')).toBe(true);
    }));
  });

  describe('Cleanup', () => {
    it('should complete effectEvents$ on destroy', () => {
      let completed = false;
      trackerService.effectEvents$.subscribe({
        complete: () => {
          completed = true;
        },
      });

      trackerService.ngOnDestroy();

      expect(completed).toBe(true);
    });
  });
});
