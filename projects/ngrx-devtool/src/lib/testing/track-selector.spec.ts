import { createSelector } from '@ngrx/store';
import { SelectorTrackerService } from '../selectors/selector-tracker.service';
import { trackSelector, setSelectorTracker, createTrackedSelector } from '../selectors/track-selector';

interface TestState {
  users: string[];
  count: number;
}

describe('trackSelector', () => {
  let tracker: SelectorTrackerService;

  const selectUsers = createSelector(
    (state: TestState) => state.users,
    (users) => users
  );

  const selectCount = createSelector(
    (state: TestState) => state.count,
    (count) => count
  );

  beforeEach(() => {
    tracker = new SelectorTrackerService();
    setSelectorTracker(tracker);
  });

  afterEach(() => {
    setSelectorTracker(null as unknown as SelectorTrackerService);
    tracker.clear();
  });

  describe('trackSelector()', () => {
    it('should return the same result as the original selector', () => {
      const tracked = trackSelector('selectUsers', selectUsers);
      const state: TestState = { users: ['Alice', 'Bob'], count: 2 };

      expect(tracked(state)).toEqual(['Alice', 'Bob']);
    });

    it('should record invocation in the tracker', () => {
      const tracked = trackSelector('selectUsers', selectUsers);
      tracked({ users: ['Alice'], count: 1 });

      const metrics = tracker.getMetrics('selectUsers');
      expect(metrics).toBeDefined();
      expect(metrics!.invocationCount).toBe(1);
    });

    it('should detect recomputation when result changes', () => {
      const tracked = trackSelector('selectUsers', selectUsers);

      tracked({ users: ['Alice'], count: 1 });
      tracked({ users: ['Alice', 'Bob'], count: 2 });

      const metrics = tracker.getMetrics('selectUsers');
      expect(metrics!.recomputationCount).toBe(2);
    });

    it('should detect cache hit when same state reference is used', () => {
      const tracked = trackSelector('selectCount', selectCount);
      const state: TestState = { users: [], count: 5 };

      tracked(state);
      tracked(state);

      const metrics = tracker.getMetrics('selectCount');
      expect(metrics!.invocationCount).toBe(2);
      // Same state = same result from memoized selector, so second call is not recomputed
      // But trackSelector tracks wasRecomputed based on result !== lastResult
      // Since result IS the same (5 === 5 from memoized), wasRecomputed should be false
      expect(metrics!.recomputationCount).toBe(1); // first call always "recomputes"
    });

    it('should preserve the release method', () => {
      const tracked = trackSelector('selectUsers', selectUsers);

      expect(typeof tracked.release).toBe('function');
    });

    it('should preserve the projector method', () => {
      const tracked = trackSelector('selectUsers', selectUsers);

      expect(typeof tracked.projector).toBe('function');
    });

    it('should work without a global tracker set', () => {
      setSelectorTracker(null as unknown as SelectorTrackerService);

      const tracked = trackSelector('selectUsers', selectUsers);
      const state: TestState = { users: ['Alice'], count: 1 };

      // Should not throw even without tracker
      expect(() => tracked(state)).not.toThrow();
      expect(tracked(state)).toEqual(['Alice']);
    });
  });

  describe('createTrackedSelector()', () => {
    it('should create and track a selector with one input', () => {
      const trackedSelector = createTrackedSelector<TestState, string[], number>(
        'userCount',
        (state: TestState) => state.users,
        (users) => users.length
      );

      const result = trackedSelector({ users: ['Alice', 'Bob'], count: 2 });

      expect(result).toBe(2);

      const metrics = tracker.getMetrics('userCount');
      expect(metrics).toBeDefined();
      expect(metrics!.invocationCount).toBe(1);
    });

    it('should create and track a selector with two inputs', () => {
      const trackedSelector = createTrackedSelector<TestState, string[], number, string>(
        'summary',
        (state: TestState) => state.users,
        (state: TestState) => state.count,
        (users, count) => `${users.length} of ${count}`
      );

      const result = trackedSelector({ users: ['Alice'], count: 5 });

      expect(result).toBe('1 of 5');
      expect(tracker.getMetrics('summary')).toBeDefined();
    });
  });

  describe('setSelectorTracker()', () => {
    it('should switch the global tracker', () => {
      const tracker2 = new SelectorTrackerService();
      const tracked = trackSelector('sel', selectCount);

      tracked({ users: [], count: 1 });
      expect(tracker.getMetrics('sel')).toBeDefined();
      expect(tracker2.getMetrics('sel')).toBeUndefined();

      setSelectorTracker(tracker2);
      tracked({ users: [], count: 2 });

      expect(tracker2.getMetrics('sel')).toBeDefined();
      expect(tracker2.getMetrics('sel')!.invocationCount).toBe(1);
    });
  });
});
