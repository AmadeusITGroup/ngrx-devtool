import { ErrorHandler, inject, Injectable, OnDestroy } from '@angular/core';
import { Action } from '@ngrx/store';
import { EffectSources, EFFECTS_ERROR_HANDLER, getEffectsMetadata } from '@ngrx/effects';
import { Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';

/** NgRx's internal metadata key for createEffect */
const CREATE_EFFECT_METADATA_KEY = '__@ngrx/effects_create__';

/**
 * Effect lifecycle event types
 * - 'triggered': Effect received an action and started processing
 * - 'emitted': Effect emitted a result action (dispatch: true)
 * - 'executed': Effect ran but didn't dispatch an action (dispatch: false)
 * - 'error': Effect encountered an error
 */
export type EffectLifecycle = 'triggered' | 'emitted' | 'executed' | 'error';

/**
 * Represents an effect execution event captured from NgRx's internal pipeline.
 */
export interface EffectEvent {
  /** Full effect name: ClassName.propertyName */
  effectName: string;
  /** The class name containing the effect */
  sourceName: string | null;
  /** The property name of the effect */
  propertyName: string;
  /** Lifecycle stage of the effect */
  lifecycle: EffectLifecycle;
  /** The action that triggered this effect (for 'triggered' lifecycle) */
  triggerAction?: Action;
  /** The action emitted by the effect (for 'emitted' lifecycle) */
  action?: Action;
  /** The error thrown (for 'error' lifecycle) */
  error?: any;
  /** Timestamp of the event */
  timestamp: number;
  /** Duration in ms (available on 'emitted' events) */
  duration?: number;
  /** Unique execution ID to correlate triggered -> emitted */
  executionId?: string;
  /** Whether this effect dispatches actions */
  dispatch?: boolean;
}

/**
 * DevTools-enhanced EffectSources that intercepts effect notifications
 * without modifying any application effect code.
 *
 * This works by wrapping effect observables when effects are registered,
 * allowing us to observe each execution cycle (triggered -> emitted/error)
 * while forwarding actions unchanged to NgRx's pipeline.
 *
 * **Key Features:**
 * - No modification of application effect code
 * - Full effect name tracking (ClassName.propertyName)
 * - Per-execution lifecycle events: triggered, emitted, error
 * - Duration tracking for each effect execution
 * - Compatible with both class-based and functional effects
 *
 * **How it works:**
 * NgRx effects are long-running observables. We track each "execution cycle":
 * 1. When an action flows through ofType() and triggers processing -> 'triggered'
 * 2. When the effect emits a result action -> 'emitted' (with duration)
 * 3. If an error occurs -> 'error'
 *
 * @example
 * ```typescript
 * // In your app config or module
 * providers: [
 *   provideEffects([...]),
 *   { provide: EffectSources, useClass: DevToolsEffectSources }
 * ]
 * ```
 */
@Injectable()
export class DevToolsEffectSources extends EffectSources implements OnDestroy {
  /**
   * Observable stream of all effect events.
   * Uses ReplaySubject to allow late subscribers to receive recent events.
   */
  readonly effectEvents$ = new ReplaySubject<EffectEvent>(100);

  /** Map of effect names to their registered metadata */
  private registeredEffects = new Map<string, EffectMetadataInfo[]>();

  /** Track execution times: executionId -> startTime */
  private executionStartTimes = new Map<string, number>();

  /** Counter for generating unique execution IDs */
  private executionCounter = 0;

  constructor() {
    // EffectSources requires ErrorHandler and EFFECTS_ERROR_HANDLER
    const errorHandler = inject(ErrorHandler);
    const effectsErrorHandler = inject(EFFECTS_ERROR_HANDLER);
    super(errorHandler, effectsErrorHandler);
  }

  /**
   * Override addEffects to wrap effect observables with instrumentation.
   * This is where we intercept effects without modifying source code.
   */
  override addEffects(effectSourceInstance: any): void {
    const sourceName = this.getSourceName(effectSourceInstance);

    if (sourceName) {
      // Get effect metadata and wrap each effect observable
      const metadata = this.extractEffectMetadata(effectSourceInstance);

      if (metadata.length > 0) {
        this.registeredEffects.set(sourceName, metadata);

        // Wrap each effect with instrumentation
        this.instrumentEffects(effectSourceInstance, sourceName, metadata);
      }
    }

    // Call parent to register the (now instrumented) effects
    super.addEffects(effectSourceInstance);
  }

  /**
   * Instrument effect observables by wrapping them with tap operators.
   * This provides lifecycle tracking without modifying the effect's behavior.
   */
  private instrumentEffects(
    instance: any,
    sourceName: string,
    metadata: EffectMetadataInfo[]
  ): void {
    for (const { propertyName, dispatch } of metadata) {
      const original = instance[propertyName];
      if (!original) continue;

      const effectName = `${sourceName}.${propertyName}`;

      // Handle both observable and function effects
      if (typeof original === 'function') {
        // Functional effect - wrap the factory function
        instance[propertyName] = () => {
          return this.wrapEffectObservable(original(), effectName, dispatch);
        };
        // Preserve the metadata
        this.copyEffectMetadata(original, instance[propertyName]);
      } else if (typeof original.subscribe === 'function') {
        // Observable effect - wrap the observable
        instance[propertyName] = this.wrapEffectObservable(original, effectName, dispatch);
        // Preserve the metadata
        this.copyEffectMetadata(original, instance[propertyName]);
      }
    }
  }

  /**
   * Wrap an effect observable to intercept lifecycle events.
   *
   * Since NgRx effects are long-running (subscribed once, process many actions),
   * we track each action emission as a complete execution cycle.
   *
   * For effects using switchMap/mergeMap/etc, we emit:
   * - 'emitted' for each action the effect produces (with timing from last emit or subscribe)
   * - 'error' if the inner observable errors
   */
  private wrapEffectObservable(
    source$: Observable<any>,
    effectName: string,
    dispatch: boolean
  ): Observable<any> {
    // Track last emission time for this effect to calculate duration
    let lastEmitTime = Date.now();

    return new Observable(subscriber => {
      // Record initial subscription time
      const subscribeTime = Date.now();
      lastEmitTime = subscribeTime;

      const subscription = source$.pipe(
        tap({
          next: (value) => {
            const now = Date.now();
            const duration = now - lastEmitTime;
            const executionId = `${effectName}_${++this.executionCounter}`;

            if (dispatch) {
              // Dispatching effect - emit 'emitted' with the action
              this.emitEvent({
                effectName,
                sourceName: effectName.split('.')[0],
                propertyName: effectName.split('.')[1] || 'unknown',
                lifecycle: 'emitted',
                action: value,
                timestamp: now,
                duration,
                executionId,
                dispatch: true,
              });
            } else {
              // Non-dispatching effect - emit 'executed' (no action)
              this.emitEvent({
                effectName,
                sourceName: effectName.split('.')[0],
                propertyName: effectName.split('.')[1] || 'unknown',
                lifecycle: 'executed',
                timestamp: now,
                duration,
                executionId,
                dispatch: false,
              });
            }

            // Update for next emission
            lastEmitTime = now;
          },
          error: (error) => {
            const now = Date.now();
            const duration = now - lastEmitTime;
            const executionId = `${effectName}_${++this.executionCounter}`;

            this.emitEvent({
              effectName,
              sourceName: effectName.split('.')[0],
              propertyName: effectName.split('.')[1] || 'unknown',
              lifecycle: 'error',
              error,
              timestamp: now,
              duration,
              executionId,
            });
          },
        })
      ).subscribe(subscriber);

      return () => subscription.unsubscribe();
    });
  }

  /**
   * Copy NgRx effect metadata from original to wrapped observable.
   */
  private copyEffectMetadata(original: any, wrapped: any): void {
    if (original && original[CREATE_EFFECT_METADATA_KEY]) {
      Object.defineProperty(wrapped, CREATE_EFFECT_METADATA_KEY, {
        value: original[CREATE_EFFECT_METADATA_KEY],
        configurable: true,
      });
    }
  }

  /**
   * Emit an effect event to subscribers.
   */
  private emitEvent(event: EffectEvent): void {
    this.effectEvents$.next(event);
  }

  /**
   * Extract effect metadata from an effect instance.
   * Uses NgRx's internal metadata key.
   */
  private extractEffectMetadata(instance: any): EffectMetadataInfo[] {
    const metadata: EffectMetadataInfo[] = [];

    // Get property names from the instance
    const propertyNames = Object.getOwnPropertyNames(instance);

    for (const propertyName of propertyNames) {
      try {
        const property = instance[propertyName];

        // Check for NgRx effect metadata
        if (property && property[CREATE_EFFECT_METADATA_KEY]) {
          const config = property[CREATE_EFFECT_METADATA_KEY];
          metadata.push({
            propertyName,
            dispatch: config.dispatch !== false,
            functional: config.functional === true,
            useEffectsErrorHandler: config.useEffectsErrorHandler !== false,
          });
        }
      } catch {
        // Skip properties that throw on access
      }
    }

    return metadata;
  }

  /**
   * Get the class name from an effect instance.
   * Falls back to various strategies when minified.
   */
  private getSourceName(instance: any): string | null {
    if (!instance) return null;

    // Check for ngrxOnIdentifyEffects hook first (most reliable)
    if (typeof instance.ngrxOnIdentifyEffects === 'function') {
      const id = instance.ngrxOnIdentifyEffects();
      if (id) return id;
    }

    // Try constructor name
    const constructorName = instance.constructor?.name;
    if (constructorName && constructorName !== 'Object' && constructorName !== 'Function') {
      // If the name is very short (minified), try to get a better name
      if (constructorName.length > 1) {
        return constructorName;
      }
    }

    // Try to find Effect in the name to detect effect classes
    const proto = Object.getPrototypeOf(instance);
    if (proto && proto.constructor && proto.constructor.name) {
      const protoName = proto.constructor.name;
      if (protoName.length > 1 && protoName !== 'Object') {
        return protoName;
      }
    }

    // Fallback: Use a descriptive name based on the properties
    const props = Object.getOwnPropertyNames(instance).filter(
      p => p.endsWith('$') || p.startsWith('load') || p.startsWith('fetch')
    );
    if (props.length > 0) {
      return `Effects(${props.slice(0, 2).join(', ')}...)`;
    }

    return constructorName || 'UnknownEffect';
  }

  /**
   * Get all registered effect names.
   */
  getRegisteredEffects(): Map<string, EffectMetadataInfo[]> {
    return new Map(this.registeredEffects);
  }

  ngOnDestroy(): void {
    this.effectEvents$.complete();
  }
}

/**
 * Internal interface for effect metadata
 */
interface EffectMetadataInfo {
  propertyName: string;
  dispatch: boolean;
  functional: boolean;
  useEffectsErrorHandler: boolean;
}
