import { APP_INITIALIZER, Provider } from '@angular/core';
import { EffectSources } from '@ngrx/effects';
import { ActionsInterceptorService } from './actions-interceptor.service';
import { DevToolsEffectSources } from './devtools-effect-sources';

export interface DevToolConfig {
  readonly wsUrl?: string;
  readonly trackEffects?: boolean;
}

export function provideNgrxDevTool(config: DevToolConfig = {}): Provider[] {
  const providers: Provider[] = [
    {
      provide: APP_INITIALIZER,
      useFactory: (interceptor: ActionsInterceptorService) => () => {
        interceptor.initialize(config.wsUrl ?? 'ws://localhost:4000');
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

export function provideEffectTracking(): Provider {
  return {
    provide: EffectSources,
    useClass: DevToolsEffectSources,
  };
}
