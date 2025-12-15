import { MemoizedSelector, createSelector, Selector } from '@ngrx/store';
import { SelectorTrackerService } from './selector-tracker.service';

/**
 * Global reference to the selector tracker (set during app initialization).
 */
let globalSelectorTracker: SelectorTrackerService | null = null;

/**
 * Set the global selector tracker instance.
 * Call this during app initialization.
 */
export function setSelectorTracker(tracker: SelectorTrackerService): void {
  globalSelectorTracker = tracker;
}

/**
 * Wrap a selector to track its performance.
 *
 * @example
 * ```typescript
 * // Original selector
 * export const selectBooks = createSelector(
 *   selectBooksState,
 *   (state) => state.books
 * );
 *
 * // Tracked selector
 * export const selectBooks = trackSelector(
 *   'selectBooks',
 *   createSelector(
 *     selectBooksState,
 *     (state) => state.books
 *   )
 * );
 * ```
 */
export function trackSelector<State, Result>(
  name: string,
  selector: MemoizedSelector<State, Result>
): MemoizedSelector<State, Result> {
  let lastResult: Result | undefined;
  let lastInput: any;

  // Create a wrapper that tracks invocations
  const trackedSelector = ((state: State) => {
    const startTime = performance.now();
    const result = selector(state);
    const endTime = performance.now();

    const computationTime = endTime - startTime;
    const wasRecomputed = result !== lastResult;
    const inputChanged = state !== lastInput;

    lastResult = result;
    lastInput = state;

    // Record metrics if tracker is available
    if (globalSelectorTracker) {
      globalSelectorTracker.recordSelectorInvocation(
        name,
        computationTime,
        wasRecomputed,
        inputChanged
      );
    }

    return result;
  }) as MemoizedSelector<State, Result>;

  // Preserve memoized selector properties
  (trackedSelector as any).release = selector.release;
  (trackedSelector as any).projector = selector.projector;
  (trackedSelector as any).setResult = selector.setResult;
  (trackedSelector as any).clearResult = selector.clearResult;

  return trackedSelector;
}

/**
 * Create a tracked selector factory.
 * Automatically names selectors based on creation order.
 */
export function createTrackedSelector<State, S1, Result>(
  name: string,
  s1: Selector<State, S1>,
  projector: (s1: S1) => Result
): MemoizedSelector<State, Result>;

export function createTrackedSelector<State, S1, S2, Result>(
  name: string,
  s1: Selector<State, S1>,
  s2: Selector<State, S2>,
  projector: (s1: S1, s2: S2) => Result
): MemoizedSelector<State, Result>;

export function createTrackedSelector<State, S1, S2, S3, Result>(
  name: string,
  s1: Selector<State, S1>,
  s2: Selector<State, S2>,
  s3: Selector<State, S3>,
  projector: (s1: S1, s2: S2, s3: S3) => Result
): MemoizedSelector<State, Result>;

export function createTrackedSelector<State, S1, S2, S3, S4, Result>(
  name: string,
  s1: Selector<State, S1>,
  s2: Selector<State, S2>,
  s3: Selector<State, S3>,
  s4: Selector<State, S4>,
  projector: (s1: S1, s2: S2, s3: S3, s4: S4) => Result
): MemoizedSelector<State, Result>;

export function createTrackedSelector(
  name: string,
  ...args: any[]
): MemoizedSelector<any, any> {
  const selector = (createSelector as any)(...args);
  return trackSelector(name, selector);
}

/**
 * Decorator to track selector performance.
 * Use on static selector properties in a class.
 *
 * @example
 * ```typescript
 * class BookSelectors {
 *   @TrackedSelector('selectAllBooks')
 *   static selectAllBooks = createSelector(
 *     selectBooksState,
 *     (state) => state.books
 *   );
 * }
 * ```
 */
export function TrackedSelector(name: string) {
  return function (target: any, propertyKey: string) {
    const originalSelector = target[propertyKey];
    if (originalSelector) {
      target[propertyKey] = trackSelector(name, originalSelector);
    }
  };
}
