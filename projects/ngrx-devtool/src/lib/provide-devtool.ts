import { APP_INITIALIZER, Provider } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { ActionsInterceptorService } from './actions-interceptor.service';

export interface DevToolConfig {
  wsUrl?: string;
  effectActionTypes?: string[];
}

/**
 * Provide NgRx DevTool with Actions interceptor.
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
 *       effectActionTypes: ['[Books API] Retrieved Book List']
 *     }),
 *   ]
 * };
 * ```
 */
export function provideNgrxDevTool(config: DevToolConfig = {}): Provider[] {
  return [
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
}
