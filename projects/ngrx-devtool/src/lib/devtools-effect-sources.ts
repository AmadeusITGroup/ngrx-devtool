import { ErrorHandler, inject, Injectable, OnDestroy } from '@angular/core';
import { Action } from '@ngrx/store';
import { EffectSources, EFFECTS_ERROR_HANDLER } from '@ngrx/effects';
import { Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';

const CREATE_EFFECT_METADATA_KEY = '__@ngrx/effects_create__';
const REPLAY_BUFFER_SIZE = 100;

export type EffectLifecycle = 'triggered' | 'emitted' | 'executed' | 'error';

export interface EffectEvent {
  readonly effectName: string;
  readonly sourceName: string;
  readonly propertyName: string;
  readonly lifecycle: EffectLifecycle;
  readonly timestamp: number;
  readonly triggerAction?: Action;
  readonly action?: Action;
  readonly error?: unknown;
  readonly duration?: number;
  readonly executionId?: string;
  readonly dispatch?: boolean;
}

interface EffectMetadataInfo {
  readonly propertyName: string;
  readonly dispatch: boolean;
  readonly functional: boolean;
  readonly useEffectsErrorHandler: boolean;
}

interface EffectConfig {
  readonly dispatch?: boolean;
  readonly functional?: boolean;
  readonly useEffectsErrorHandler?: boolean;
}

interface EffectSourceInstance {
  ngrxOnIdentifyEffects?(): string;
  constructor: { name?: string };
  [key: string]: unknown;
}

type EffectObservable = Observable<Action> & {
  [CREATE_EFFECT_METADATA_KEY]?: EffectConfig;
};

/**
 * Intercepts NgRx effects to track lifecycle events without modifying application code.
 * Wraps effect observables during registration to emit triggered/emitted/error events.
 */
@Injectable()
export class DevToolsEffectSources extends EffectSources implements OnDestroy {
  readonly effectEvents$ = new ReplaySubject<EffectEvent>(REPLAY_BUFFER_SIZE);

  private readonly registeredEffects = new Map<string, readonly EffectMetadataInfo[]>();
  private executionCounter = 0;

  constructor() {
    super(inject(ErrorHandler), inject(EFFECTS_ERROR_HANDLER));
  }

  override addEffects(effectSourceInstance: EffectSourceInstance): void {
    const sourceName = this.resolveSourceName(effectSourceInstance);

    if (sourceName) {
      const metadata = this.extractEffectMetadata(effectSourceInstance);

      if (metadata.length > 0) {
        this.registeredEffects.set(sourceName, metadata);
        this.instrumentEffects(effectSourceInstance, sourceName, metadata);
      }
    }

    super.addEffects(effectSourceInstance);
  }

  getRegisteredEffects(): ReadonlyMap<string, readonly EffectMetadataInfo[]> {
    return this.registeredEffects;
  }

  ngOnDestroy(): void {
    this.effectEvents$.complete();
  }

  private instrumentEffects(
    instance: EffectSourceInstance,
    sourceName: string,
    metadata: readonly EffectMetadataInfo[]
  ): void {
    for (const { propertyName, dispatch } of metadata) {
      const original = instance[propertyName];
      if (!original) continue;

      const effectName = `${sourceName}.${propertyName}`;

      if (typeof original === 'function') {
        const factory = original as () => EffectObservable;
        const wrapped = () => this.wrapEffectObservable(factory(), effectName, dispatch);
        this.copyEffectMetadata(factory, wrapped);
        instance[propertyName] = wrapped;
      } else if (this.isObservable(original)) {
        const wrapped = this.wrapEffectObservable(original, effectName, dispatch);
        this.copyEffectMetadata(original as EffectObservable, wrapped);
        instance[propertyName] = wrapped;
      }
    }
  }

  private wrapEffectObservable(
    source$: Observable<Action>,
    effectName: string,
    dispatch: boolean
  ): Observable<Action> {
    const [sourceName, propertyName] = this.parseEffectName(effectName);

    return new Observable(subscriber => {
      let lastEmitTime = Date.now();

      const subscription = source$.pipe(
        tap({
          next: (value: Action) => {
            const now = Date.now();
            this.emitEvent({
              effectName,
              sourceName,
              propertyName,
              lifecycle: dispatch ? 'emitted' : 'executed',
              action: dispatch ? value : undefined,
              timestamp: now,
              duration: now - lastEmitTime,
              executionId: this.generateExecutionId(effectName),
              dispatch,
            });
            lastEmitTime = now;
          },
          error: (err: unknown) => {
            const now = Date.now();
            this.emitEvent({
              effectName,
              sourceName,
              propertyName,
              lifecycle: 'error',
              error: err,
              timestamp: now,
              duration: now - lastEmitTime,
              executionId: this.generateExecutionId(effectName),
            });
          },
        })
      ).subscribe(subscriber);

      return () => subscription.unsubscribe();
    });
  }

  private copyEffectMetadata(
    original: EffectObservable | (() => EffectObservable),
    wrapped: EffectObservable | (() => EffectObservable)
  ): void {
    const originalRecord = original as unknown as Record<string, unknown>;
    const metadata = originalRecord[CREATE_EFFECT_METADATA_KEY];
    if (metadata) {
      Object.defineProperty(wrapped, CREATE_EFFECT_METADATA_KEY, {
        value: metadata,
        configurable: true,
      });
    }
  }

  private extractEffectMetadata(instance: EffectSourceInstance): EffectMetadataInfo[] {
    const metadata: EffectMetadataInfo[] = [];

    for (const propertyName of Object.getOwnPropertyNames(instance)) {
      try {
        const property = instance[propertyName] as EffectObservable | undefined;
        const config = property?.[CREATE_EFFECT_METADATA_KEY];

        if (config) {
          metadata.push({
            propertyName,
            dispatch: config.dispatch !== false,
            functional: config.functional === true,
            useEffectsErrorHandler: config.useEffectsErrorHandler !== false,
          });
        }
      } catch {
        // Skip inaccessible properties
      }
    }

    return metadata;
  }

  private resolveSourceName(instance: EffectSourceInstance): string | null {
    if (!instance) return null;

    if (typeof instance.ngrxOnIdentifyEffects === 'function') {
      const id = instance.ngrxOnIdentifyEffects();
      if (id) return id;
    }

    const constructorName = instance.constructor?.name;
    if (this.isValidClassName(constructorName)) {
      return constructorName;
    }

    const proto = Object.getPrototypeOf(instance) as EffectSourceInstance | null;
    const protoName = proto?.constructor?.name;
    if (this.isValidClassName(protoName)) {
      return protoName;
    }

    const effectProps = Object.getOwnPropertyNames(instance)
      .filter(p => p.endsWith('$') || p.startsWith('load') || p.startsWith('fetch'));

    if (effectProps.length > 0) {
      return `Effects(${effectProps.slice(0, 2).join(', ')}...)`;
    }

    return constructorName ?? 'UnknownEffect';
  }

  private isValidClassName(name: string | undefined): name is string {
    return Boolean(name && name.length > 1 && name !== 'Object' && name !== 'Function');
  }

  private isObservable(value: unknown): value is Observable<Action> {
    return Boolean(value && typeof (value as Observable<Action>).subscribe === 'function');
  }

  private parseEffectName(effectName: string): [string, string] {
    const [sourceName, propertyName = 'unknown'] = effectName.split('.');
    return [sourceName, propertyName];
  }

  private generateExecutionId(effectName: string): string {
    return `${effectName}_${++this.executionCounter}`;
  }

  private emitEvent(event: EffectEvent): void {
    this.effectEvents$.next(event);
  }
}
