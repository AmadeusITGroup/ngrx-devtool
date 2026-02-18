import { SelectorTrackerService } from '../selectors/selector-tracker.service';

describe('SelectorTrackerService', () => {
  let service: SelectorTrackerService;

  beforeEach(() => {
    service = new SelectorTrackerService();
  });

  afterEach(() => {
    service.clear();
  });

  describe('recordSelectorInvocation()', () => {
    it('should create a new metric entry for a new selector', () => {
      service.recordSelectorInvocation('selectUsers', 1.5, true, true);

      const metrics = service.getMetrics('selectUsers');
      expect(metrics).toBeDefined();
      expect(metrics!.name).toBe('selectUsers');
      expect(metrics!.invocationCount).toBe(1);
      expect(metrics!.recomputationCount).toBe(1);
      expect(metrics!.totalComputationTime).toBe(1.5);
    });

    it('should update existing metric on subsequent invocations', () => {
      service.recordSelectorInvocation('selectUsers', 2, true, true);
      service.recordSelectorInvocation('selectUsers', 4, true, true);

      const metrics = service.getMetrics('selectUsers');
      expect(metrics!.invocationCount).toBe(2);
      expect(metrics!.recomputationCount).toBe(2);
      expect(metrics!.totalComputationTime).toBe(6);
      expect(metrics!.avgComputationTime).toBe(3);
    });

    it('should track max computation time', () => {
      service.recordSelectorInvocation('sel', 10, true, true);
      service.recordSelectorInvocation('sel', 5, true, true);
      service.recordSelectorInvocation('sel', 20, true, true);

      const metrics = service.getMetrics('sel');
      expect(metrics!.maxComputationTime).toBe(20);
    });

    it('should not add to computation time for cache hits (wasRecomputed = false)', () => {
      service.recordSelectorInvocation('sel', 1, true, true);  // recomputed
      service.recordSelectorInvocation('sel', 0.1, false, false); // cache hit

      const metrics = service.getMetrics('sel');
      expect(metrics!.invocationCount).toBe(2);
      expect(metrics!.recomputationCount).toBe(1);
      expect(metrics!.totalComputationTime).toBe(1); // only the first
    });

    it('should calculate cache hit rate correctly', () => {
      // 4 invocations, 1 recomputed = 75% cache hit rate
      service.recordSelectorInvocation('sel', 5, true, true);   // recomputed
      service.recordSelectorInvocation('sel', 0, false, false);  // cache hit
      service.recordSelectorInvocation('sel', 0, false, false);  // cache hit
      service.recordSelectorInvocation('sel', 0, false, false);  // cache hit

      const metrics = service.getMetrics('sel');
      expect(metrics!.cacheHitRate).toBe(75);
    });

    it('should have 0% cache hit rate when all invocations recompute', () => {
      service.recordSelectorInvocation('sel', 5, true, true);
      service.recordSelectorInvocation('sel', 3, true, true);

      const metrics = service.getMetrics('sel');
      expect(metrics!.cacheHitRate).toBe(0);
    });

    it('should record triggering action from pending action', () => {
      service.markActionDispatch('[Users] Load');
      service.recordSelectorInvocation('selectUsers', 1, true, true);

      const metrics = service.getMetrics('selectUsers');
      expect(metrics!.triggeringActions).toContain('[Users] Load');
    });

    it('should limit triggering actions list to 10', () => {
      for (let i = 0; i < 15; i++) {
        service.markActionDispatch(`Action_${i}`);
        service.recordSelectorInvocation('sel', 1, true, true);
      }

      const metrics = service.getMetrics('sel');
      expect(metrics!.triggeringActions.length).toBeLessThanOrEqual(10);
    });

    it('should not duplicate triggering actions', () => {
      service.markActionDispatch('[Users] Load');
      service.recordSelectorInvocation('sel', 1, true, true);
      service.recordSelectorInvocation('sel', 1, true, true);

      const metrics = service.getMetrics('sel');
      const loadCount = metrics!.triggeringActions.filter(a => a === '[Users] Load').length;
      expect(loadCount).toBe(1);
    });
  });

  describe('markActionDispatch() and markReducerComplete()', () => {
    it('should track the dispatch time', () => {
      const before = performance.now();
      service.markActionDispatch('[Test] Action');
      const after = performance.now();

      const pending = (service as unknown as { pendingAction: { type: string; dispatchTime: number } }).pendingAction;
      expect(pending.type).toBe('[Test] Action');
      expect(pending.dispatchTime).toBeGreaterThanOrEqual(before);
      expect(pending.dispatchTime).toBeLessThanOrEqual(after);
    });

    it('should record reducer complete time and duration', () => {
      service.markActionDispatch('[Test] Action');
      service.markReducerComplete(5.5);

      const pending = (service as unknown as { pendingAction: { reducerTime: number; reducerCompleteTime: number } }).pendingAction;
      expect(pending.reducerTime).toBe(5.5);
      expect(pending.reducerCompleteTime).toBeGreaterThan(0);
    });

    it('should not fail if markReducerComplete called without dispatch', () => {
      expect(() => service.markReducerComplete(5)).not.toThrow();
    });
  });

  describe('markSelectorsComplete()', () => {
    it('should return null when no pending action', () => {
      const result = service.markSelectorsComplete();

      expect(result).toBeNull();
    });

    it('should return end-to-end timing with correct action type', () => {
      service.markActionDispatch('[Users] Load');
      service.markReducerComplete(2);
      service.recordSelectorInvocation('selectUsers', 1, true, true);
      const timing = service.markSelectorsComplete();

      expect(timing).not.toBeNull();
      expect(timing!.actionType).toBe('[Users] Load');
      expect(timing!.totalTime).toBeGreaterThan(0);
      expect(timing!.reducerTime).toBe(2);
    });

    it('should include affected selectors in timing', () => {
      service.markActionDispatch('[Users] Load');
      service.recordSelectorInvocation('selectUsers', 1, true, true);
      service.recordSelectorInvocation('selectUserCount', 0.5, true, true);
      const timing = service.markSelectorsComplete();

      expect(timing!.affectedSelectors).toContain('selectUsers');
      expect(timing!.affectedSelectors).toContain('selectUserCount');
    });

    it('should deduplicate affected selectors', () => {
      service.markActionDispatch('[Users] Load');
      service.recordSelectorInvocation('selectUsers', 1, true, true);
      service.recordSelectorInvocation('selectUsers', 0.5, false, false);
      const timing = service.markSelectorsComplete();

      const count = timing!.affectedSelectors.filter(s => s === 'selectUsers').length;
      expect(count).toBe(1);
    });

    it('should clear pending action after completion', () => {
      service.markActionDispatch('[Users] Load');
      service.markSelectorsComplete();

      const pending = (service as unknown as { pendingAction: unknown }).pendingAction;
      expect(pending).toBeNull();
    });
  });

  describe('getAllMetrics()', () => {
    it('should return a copy of the metrics map', () => {
      service.recordSelectorInvocation('A', 1, true, true);
      service.recordSelectorInvocation('B', 2, true, true);

      const allMetrics = service.getAllMetrics();

      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('A')).toBe(true);
      expect(allMetrics.has('B')).toBe(true);
    });

    it('should return empty map when nothing recorded', () => {
      expect(service.getAllMetrics().size).toBe(0);
    });
  });

  describe('getSlowestSelectors()', () => {
    it('should return selectors sorted by total computation time', () => {
      service.recordSelectorInvocation('fast', 1, true, true);
      service.recordSelectorInvocation('slow', 10, true, true);
      service.recordSelectorInvocation('medium', 5, true, true);

      const slowest = service.getSlowestSelectors(3);

      expect(slowest[0].name).toBe('slow');
      expect(slowest[1].name).toBe('medium');
      expect(slowest[2].name).toBe('fast');
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        service.recordSelectorInvocation(`sel_${i}`, i, true, true);
      }

      expect(service.getSlowestSelectors(5)).toHaveLength(5);
    });

    it('should default to 10 results', () => {
      for (let i = 0; i < 20; i++) {
        service.recordSelectorInvocation(`sel_${i}`, i, true, true);
      }

      expect(service.getSlowestSelectors()).toHaveLength(10);
    });
  });

  describe('getInefficientSelectors()', () => {
    it('should return selectors below cache hit threshold with > 5 invocations', () => {
      // Selector with 30% cache hit rate (7 recomputed, 3 cached)
      for (let i = 0; i < 7; i++) {
        service.recordSelectorInvocation('inefficient', 1, true, true);
      }
      for (let i = 0; i < 3; i++) {
        service.recordSelectorInvocation('inefficient', 0, false, false);
      }

      // Efficient selector: 80% cache hit rate
      service.recordSelectorInvocation('efficient', 1, true, true);
      for (let i = 0; i < 9; i++) {
        service.recordSelectorInvocation('efficient', 0, false, false);
      }

      const inefficient = service.getInefficientSelectors(50);

      expect(inefficient).toHaveLength(1);
      expect(inefficient[0].name).toBe('inefficient');
    });

    it('should not return selectors with <= 5 invocations', () => {
      service.recordSelectorInvocation('new', 1, true, true);
      service.recordSelectorInvocation('new', 1, true, true);

      const inefficient = service.getInefficientSelectors(50);

      expect(inefficient).toHaveLength(0);
    });

    it('should sort by cache hit rate ascending', () => {
      // 10% cache hit
      for (let i = 0; i < 9; i++) {
        service.recordSelectorInvocation('worst', 1, true, true);
      }
      service.recordSelectorInvocation('worst', 0, false, false);

      // 40% cache hit
      for (let i = 0; i < 6; i++) {
        service.recordSelectorInvocation('bad', 1, true, true);
      }
      for (let i = 0; i < 4; i++) {
        service.recordSelectorInvocation('bad', 0, false, false);
      }

      const results = service.getInefficientSelectors(50);

      expect(results[0].name).toBe('worst');
      expect(results[1].name).toBe('bad');
    });
  });

  describe('getEndToEndTimings()', () => {
    it('should return recorded end-to-end timings', () => {
      service.markActionDispatch('[A]');
      service.markSelectorsComplete();
      service.markActionDispatch('[B]');
      service.markSelectorsComplete();

      const timings = service.getEndToEndTimings();

      expect(timings).toHaveLength(2);
      expect(timings[0].actionType).toBe('[A]');
      expect(timings[1].actionType).toBe('[B]');
    });

    it('should return a copy, not the internal array', () => {
      service.markActionDispatch('[A]');
      service.markSelectorsComplete();

      const timings = service.getEndToEndTimings();
      expect(timings).not.toBe(
        (service as unknown as { endToEndTimings: unknown[] }).endToEndTimings
      );
    });
  });

  describe('getAverageEndToEndTime()', () => {
    it('should return 0 when no timings recorded', () => {
      expect(service.getAverageEndToEndTime()).toBe(0);
    });

    it('should calculate average of recorded timings', () => {
      service.markActionDispatch('[A]');
      service.markSelectorsComplete();
      service.markActionDispatch('[B]');
      service.markSelectorsComplete();

      const avg = service.getAverageEndToEndTime();

      expect(avg).toBeGreaterThan(0);
    });
  });

  describe('clear()', () => {
    it('should reset all internal state', () => {
      service.recordSelectorInvocation('sel', 5, true, true);
      service.markActionDispatch('[A]');
      service.markSelectorsComplete();

      service.clear();

      expect(service.getAllMetrics().size).toBe(0);
      expect(service.getEndToEndTimings()).toHaveLength(0);
      expect(service.getAverageEndToEndTime()).toBe(0);
    });
  });

  describe('invocation buffer trimming', () => {
    it('should trim recent invocations when exceeding 500', () => {
      for (let i = 0; i < 510; i++) {
        service.recordSelectorInvocation(`sel_${i % 10}`, 0.1, true, true);
      }

      const internal = (service as unknown as { recentInvocations: unknown[] }).recentInvocations;
      expect(internal.length).toBeLessThanOrEqual(500);
    });
  });

  describe('end-to-end timing trimming', () => {
    it('should trim timings when exceeding 100', () => {
      for (let i = 0; i < 105; i++) {
        service.markActionDispatch(`[Action_${i}]`);
        service.markSelectorsComplete();
      }

      const timings = service.getEndToEndTimings();
      expect(timings.length).toBeLessThanOrEqual(100);
    });
  });
});
