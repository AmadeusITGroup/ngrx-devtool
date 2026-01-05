import { MemoizedSelector, createSelector, Selector } from '@ngrx/store';
import { SelectorTrackerService } from './selector-tracker.service';

let globalSelectorTracker: SelectorTrackerService | null = null;

export function setSelectorTracker(tracker: SelectorTrackerService): void {
  globalSelectorTracker = tracker;
}

export function trackSelector<State, Result>(
  name: string,
  selector: MemoizedSelector<State, Result>
): MemoizedSelector<State, Result> {
  let lastResult: Result | undefined;
  let lastInput: State | undefined;

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

export function TrackedSelector(name: string) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const originalSelector = target[propertyKey] as MemoizedSelector<unknown, unknown>;
    if (originalSelector) {
      target[propertyKey] = trackSelector(name, originalSelector);
    }
  };
}
