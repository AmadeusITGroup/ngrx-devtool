import { APP_INITIALIZER, Provider } from '@angular/core';
import { EffectSources } from '@ngrx/effects';
import { ActionsInterceptorService } from './actions-interceptor.service';
import { DevToolsEffectSources } from './devtools-effect-sources';

export interface DevToolConfig {
  wsUrl?: string;
  effectActionTypes?: string[];
  /**
   * Enable effect lifecycle tracking.
   * This provides detailed effect execution events including:
   * - Effect names (ClassName.propertyName)
   * - Lifecycle events (started, emitted, error, complete)
   * - Duration tracking
   *
   * @default true
   */
  trackEffects?: boolean;
}

/**
 * Provide NgRx DevTool with Actions interceptor and optional effect tracking.
 * This enables automatic effect tracking without code changes.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideStore({ ... }),
 *     provideEffects([...]),
 *     provideNgrxDevTool({
 *       wsUrl: 'ws://localhost:4000',
 *       trackEffects: true, // Enable detailed effect tracking
 *       effectActionTypes: ['[Books API] Retrieved Book List']
 *     }),
 *   ]
 * };
 * ```
 */
export function provideNgrxDevTool(config: DevToolConfig = {}): Provider[] {
  const providers: Provider[] = [
    {
      provide: APP_INITIALIZER,
      useFactory: (interceptor: ActionsInterceptorService) => () => {
        interceptor.initialize(config.wsUrl ?? 'ws://localhost:4000');

        if (config.effectActionTypes?.length) {
          interceptor.registerEffectActions(config.effectActionTypes);
        }
      },
      deps: [ActionsInterceptorService],
      multi: true,
    },
  ];

  // Add effect tracking if enabled (default: true)
  if (config.trackEffects !== false) {
    providers.push({
      provide: EffectSources,
      useClass: DevToolsEffectSources,
    });
  }

  return providers;
}

/**
 * Provide just the DevToolsEffectSources without the full devtool.
 * Useful if you only want effect lifecycle tracking without WebSocket integration.
 *
 * @example
 * ```typescript
 * providers: [
 *   provideEffects([...]),
 *   provideEffectTracking(),
 * ]
 * ```
 */
export function provideEffectTracking(): Provider {
  return {
    provide: EffectSources,
    useClass: DevToolsEffectSources,
  };
}
