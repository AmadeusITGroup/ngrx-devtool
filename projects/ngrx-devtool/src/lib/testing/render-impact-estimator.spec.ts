import { estimateRenderImpact } from '../performance/render-impact-estimator';

describe('estimateRenderImpact()', () => {
  describe('with identical or missing states', () => {
    it('should return score 0 when states are identical references', () => {
      const state = { users: [1, 2], settings: { theme: 'dark' } };
      const result = estimateRenderImpact(state, state);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.factors).toHaveLength(0);
    });

    it('should handle null prev state gracefully', () => {
      const result = estimateRenderImpact(null, { a: 1 });

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    it('should handle null next state gracefully', () => {
      const result = estimateRenderImpact({ a: 1 }, null);

      expect(result.score).toBe(0);
    });

    it('should handle both null states', () => {
      const result = estimateRenderImpact(null, null);

      expect(result.score).toBe(0);
    });

    it('should handle non-object primitives', () => {
      const result = estimateRenderImpact('string', 42);

      expect(result.score).toBe(0);
    });
  });

  describe('root property changes', () => {
    it('should detect single root property change', () => {
      const settings = { theme: 'dark' };
      const prev = { users: [] as number[], settings };
      const next = { users: [1], settings };

      const result = estimateRenderImpact(prev, next);

      expect(result.score).toBeGreaterThan(0);
      const rootFactor = result.factors.find(f => f.name === 'Root State Changes');
      expect(rootFactor).toBeDefined();
      expect(rootFactor!.description).toContain('1 top-level');
    });

    it('should score higher with more root properties changed', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const next = { a: 10, b: 20, c: 30 };

      const result = estimateRenderImpact(prev, next);

      const rootFactor = result.factors.find(f => f.name === 'Root State Changes');
      expect(rootFactor).toBeDefined();
      expect(rootFactor!.description).toContain('3');
      expect(rootFactor!.impact).toBeGreaterThan(15);
    });

    it('should detect added root property', () => {
      const prev = { a: 1 };
      const next = { a: 1, b: 2 };

      const result = estimateRenderImpact(prev, next);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should recommend batching when many root properties change', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const next = { a: 10, b: 20, c: 30 };

      const result = estimateRenderImpact(prev, next);

      expect(result.recommendations.some(r => r.toLowerCase().includes('batch'))).toBe(true);
    });
  });

  describe('array changes', () => {
    it('should detect array length changes', () => {
      const prev = { items: [1, 2, 3] };
      const next = { items: [1, 2, 3, 4, 5] };

      const result = estimateRenderImpact(prev, next);

      const arrayFactor = result.factors.find(f => f.name === 'Array Mutations');
      expect(arrayFactor).toBeDefined();
    });

    it('should recommend virtual scrolling for large arrays', () => {
      const prev = { items: Array.from({ length: 50 }, (_, i) => i) };
      const next = { items: Array.from({ length: 150 }, (_, i) => i) };

      const result = estimateRenderImpact(prev, next);

      expect(result.recommendations.some(r => r.includes('virtual scrolling'))).toBe(true);
    });

    it('should recommend trackBy for large arrays', () => {
      const prev = { items: Array.from({ length: 50 }, (_, i) => i) };
      const next = { items: Array.from({ length: 150 }, (_, i) => i) };

      const result = estimateRenderImpact(prev, next);

      expect(result.recommendations.some(r => r.includes('trackBy'))).toBe(true);
    });

    it('should detect array shrinking', () => {
      const prev = { items: [1, 2, 3, 4, 5] };
      const next = { items: [1] };

      const result = estimateRenderImpact(prev, next);

      const arrayFactor = result.factors.find(f => f.name === 'Array Mutations');
      expect(arrayFactor).toBeDefined();
    });
  });

  describe('large object changes', () => {
    it('should detect large object modifications', () => {
      // Generate an object > 5000 bytes when stringified
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < 200; i++) {
        largeObj[`key_${i}`] = `value_${i}_padding_to_make_it_bigger`;
      }

      const prev = { data: {} };
      const next = { data: largeObj };

      const result = estimateRenderImpact(prev, next);

      const largeFactor = result.factors.find(f => f.name === 'Large Object Changes');
      expect(largeFactor).toBeDefined();
    });

    it('should recommend normalization for large object changes', () => {
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < 200; i++) {
        largeObj[`key_${i}`] = `value_${i}_padding_to_make_it_bigger`;
      }

      const prev = { data: {} };
      const next = { data: largeObj };

      const result = estimateRenderImpact(prev, next);

      expect(result.recommendations.some(r => r.includes('normalized') || r.includes('Break down'))).toBe(true);
    });
  });

  describe('deep nesting', () => {
    it('should detect deeply nested state changes', () => {
      const prev = { a: { b: { c: { d: { e: 1 } } } } };
      const next = { a: { b: { c: { d: { e: 2 } } } } };

      const result = estimateRenderImpact(prev, next);

      const deepFactor = result.factors.find(f => f.name === 'Deep State Changes');
      expect(deepFactor).toBeDefined();
      expect(deepFactor!.description).toContain('depth');
    });

    it('should recommend normalization for deeply nested changes', () => {
      const prev = { a: { b: { c: { d: { e: { f: 1 } } } } } };
      const next = { a: { b: { c: { d: { e: { f: 2 } } } } } };

      const result = estimateRenderImpact(prev, next);

      expect(result.recommendations.some(r => r.includes('Normalize'))).toBe(true);
    });
  });

  describe('property change volume', () => {
    it('should detect high volume of property changes', () => {
      const prev: Record<string, number> = {};
      const next: Record<string, number> = {};
      for (let i = 0; i < 20; i++) {
        prev[`prop${i}`] = i;
        next[`prop${i}`] = i + 100;
      }

      const result = estimateRenderImpact(prev, next);

      const volumeFactor = result.factors.find(f => f.name === 'Property Change Volume');
      expect(volumeFactor).toBeDefined();
    });
  });

  describe('impact levels', () => {
    it('should classify score < 25 as low', () => {
      const prev = { a: 1 };
      const next = { a: 2 };

      const result = estimateRenderImpact(prev, next);

      expect(result.level).toBe('low');
    });

    it('should classify high-impact changes appropriately', () => {
      // Many root changes + arrays + large objects = high/critical
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < 200; i++) {
        largeObj[`k${i}`] = `v${i}_padding_to_make_this_object_large_enough`;
      }

      const prev = {
        slice1: [],
        slice2: { data: {} },
        slice3: { nested: { deep: { value: 1 } } },
        slice4: [1, 2, 3],
      };
      const next = {
        slice1: Array.from({ length: 50 }, (_, i) => i),
        slice2: { data: largeObj },
        slice3: { nested: { deep: { value: 2 } } },
        slice4: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      };

      const result = estimateRenderImpact(prev, next);

      expect(['medium', 'high', 'critical']).toContain(result.level);
    });
  });

  describe('estimated components affected', () => {
    it('should estimate more components for more root changes', () => {
      const result1 = estimateRenderImpact({ a: 1 }, { a: 2 });
      const result2 = estimateRenderImpact(
        { a: 1, b: 2, c: 3 },
        { a: 10, b: 20, c: 30 }
      );

      expect(result2.estimatedComponentsAffected).toBeGreaterThan(
        result1.estimatedComponentsAffected
      );
    });

    it('should be 0 when no changes detected', () => {
      const state = { a: 1 };
      const result = estimateRenderImpact(state, state);

      expect(result.estimatedComponentsAffected).toBe(0);
    });
  });

  describe('score capping', () => {
    it('should never exceed 100', () => {
      // Create extreme state change
      const prev: Record<string, unknown> = {};
      const next: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        prev[`slice${i}`] = { old: i };
        next[`slice${i}`] = Array.from({ length: 200 }, (_, j) => ({ val: j }));
      }

      const result = estimateRenderImpact(prev, next);

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
