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

  const trackedSelector = ((state: State) => {
    const startTime = performance.now();
    const result = selector(state);
    const endTime = performance.now();

    const computationTime = endTime - startTime;
    const wasRecomputed = result !== lastResult;
    const inputChanged = state !== lastInput;

    lastResult = result;
    lastInput = state;

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

  (trackedSelector as unknown as { release: typeof selector.release }).release = selector.release;
  (trackedSelector as unknown as { projector: typeof selector.projector }).projector = selector.projector;
  (trackedSelector as unknown as { setResult: typeof selector.setResult }).setResult = selector.setResult;
  (trackedSelector as unknown as { clearResult: typeof selector.clearResult }).clearResult = selector.clearResult;

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
  ...args: unknown[]
): MemoizedSelector<unknown, unknown> {
  const selector = (createSelector as (...args: unknown[]) => MemoizedSelector<unknown, unknown>)(...args);
  return trackSelector(name, selector);
}

export function TrackedSelector(name: string) {
  return function (target: Record<string, unknown>, propertyKey: string): void {
    const originalSelector = target[propertyKey] as MemoizedSelector<unknown, unknown>;
    if (originalSelector) {
      target[propertyKey] = trackSelector(name, originalSelector);
    }
  };
}
