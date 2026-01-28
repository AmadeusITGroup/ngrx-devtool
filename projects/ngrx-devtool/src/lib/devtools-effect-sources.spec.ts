import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Store, provideStore } from '@ngrx/store';
import { provideEffects, EffectSources } from '@ngrx/effects';

import { DevToolsEffectSources, EffectEvent } from './devtools-effect-sources';
import { TestEffects, testActions, testReducer } from './testing/test-effects';

describe('DevToolsEffectSources', () => {
  let store: Store;
  let effectSources: DevToolsEffectSources;
  let collectedEvents: EffectEvent[];

  beforeEach(() => {
    collectedEvents = [];

    TestBed.configureTestingModule({
      providers: [
        provideStore({ test: testReducer }),
        provideEffects([TestEffects]),
        // Replace EffectSources with our DevToolsEffectSources
        { provide: EffectSources, useClass: DevToolsEffectSources },
      ],
    });

    store = TestBed.inject(Store);
    effectSources = TestBed.inject(EffectSources) as DevToolsEffectSources;

    // Collect all effect events
    effectSources.effectEvents$.subscribe((event) => {
      collectedEvents.push(event);
    });
  });

  afterEach(() => {
    collectedEvents = [];
  });

  describe('Effect Registration', () => {
    it('should register effects and track their metadata', () => {
      const registered = effectSources.getRegisteredEffects();

      expect(registered.size).toBeGreaterThan(0);
      expect(registered.has('TestEffects')).toBe(true);

      const testEffectsMeta = registered.get('TestEffects');
      expect(testEffectsMeta).toBeDefined();
      expect(testEffectsMeta!.length).toBeGreaterThan(0);
    });

    it('should identify effect properties with correct dispatch flag', () => {
      const registered = effectSources.getRegisteredEffects();
      const testEffectsMeta = registered.get('TestEffects')!;

      // Find the logEffect$ which has dispatch: false
      const logEffect = testEffectsMeta.find((m) => m.propertyName === 'logEffect$');
      expect(logEffect).toBeDefined();
      expect(logEffect!.dispatch).toBe(false);

      // Find loadItems$ which should have dispatch: true (default)
      const loadItemsEffect = testEffectsMeta.find((m) => m.propertyName === 'loadItems$');
      expect(loadItemsEffect).toBeDefined();
      expect(loadItemsEffect!.dispatch).toBe(true);
    });
  });

  describe('Effect Event Emission', () => {
    it('should emit "emitted" event when dispatching effect emits an action', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(100);

      const emittedEvents = collectedEvents.filter((e) => e.lifecycle === 'emitted');
      expect(emittedEvents.length).toBeGreaterThan(0);

      const loadItemsEvent = emittedEvents.find((e) =>
        e.effectName.includes('loadItems$')
      );
      expect(loadItemsEvent).toBeDefined();
      expect(loadItemsEvent!.action?.type).toBe(testActions.loadItemsSuccess.type);
      expect(loadItemsEvent!.dispatch).toBe(true);
    }));

    it('should emit "executed" event for non-dispatching effects', fakeAsync(() => {
      store.dispatch(testActions.noopAction());
      tick(100);

      const executedEvents = collectedEvents.filter((e) => e.lifecycle === 'executed');
      expect(executedEvents.length).toBeGreaterThan(0);

      const logEvent = executedEvents.find((e) => e.effectName.includes('logEffect$'));
      expect(logEvent).toBeDefined();
      expect(logEvent!.dispatch).toBe(false);
      // Non-dispatching effects should not have an action
      expect(logEvent!.action).toBeUndefined();
    }));

    it('should track duration for async effects', fakeAsync(() => {
      store.dispatch(testActions.triggerAsync());
      tick(100); // Wait for the 50ms delay + processing

      const emittedEvents = collectedEvents.filter((e) => e.lifecycle === 'emitted');
      const asyncEvent = emittedEvents.find((e) =>
        e.effectName.includes('asyncEffect$')
      );

      expect(asyncEvent).toBeDefined();
      expect(asyncEvent!.duration).toBeDefined();
      expect(asyncEvent!.duration).toBeGreaterThanOrEqual(40); // Allow some tolerance
    }));

    it('should include executionId for tracking', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(100);

      const emittedEvent = collectedEvents.find((e) => e.lifecycle === 'emitted');
      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.executionId).toBeDefined();
      expect(emittedEvent!.executionId).toContain('loadItems$');
    }));

    it('should correctly parse effect names into sourceName and propertyName', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(100);

      const event = collectedEvents.find((e) => e.lifecycle === 'emitted');
      expect(event).toBeDefined();
      expect(event!.sourceName).toBe('TestEffects');
      expect(event!.propertyName).toBe('loadItems$');
    }));
  });

  describe('Multiple Effect Emissions', () => {
    it('should track multiple sequential action dispatches', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(50);
      store.dispatch(testActions.addItem({ item: 'test-item' }));
      tick(50);

      const emittedEvents = collectedEvents.filter((e) => e.lifecycle === 'emitted');
      expect(emittedEvents.length).toBeGreaterThanOrEqual(2);

      const actionTypes = emittedEvents.map((e) => e.action?.type);
      expect(actionTypes).toContain(testActions.loadItemsSuccess.type);
      expect(actionTypes).toContain(testActions.addItemSuccess.type);
    }));

    it('should generate unique executionIds for each emission', fakeAsync(() => {
      store.dispatch(testActions.loadItems());
      tick(50);
      store.dispatch(testActions.loadItems());
      tick(50);

      const emittedEvents = collectedEvents.filter(
        (e) => e.lifecycle === 'emitted' && e.effectName.includes('loadItems$')
      );

      expect(emittedEvents.length).toBe(2);
      expect(emittedEvents[0].executionId).not.toBe(emittedEvents[1].executionId);
    }));
  });

  describe('Cleanup', () => {
    it('should complete effectEvents$ on destroy', () => {
      let completed = false;
      effectSources.effectEvents$.subscribe({
        complete: () => {
          completed = true;
        },
      });

      effectSources.ngOnDestroy();

      expect(completed).toBe(true);
    });
  });
});
