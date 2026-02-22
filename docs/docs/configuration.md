---
sidebar_position: 2
title: Configuration
---

# Configuration

Configure NgRx DevTool in your Angular application.

## Option A: Standalone (recommended)

```typescript
// app.config.ts
import { provideNgrxDevTool, createDevToolMetaReducer } from 'ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      { /* your reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    provideEffects([...]),
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
};
```

## Option B: NgModule with separate store module

Common in large enterprise apps.

```typescript
// store.module.ts
import { createDevToolMetaReducer } from 'ngrx-devtool';

@NgModule({
  imports: [
    StoreModule.forRoot(
      { /* your reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    EffectsModule.forRoot([...])
  ]
})
export class RootStoreModule {}
```

:::warning
`createDevToolMetaReducer()` must be added to the same `provideStore()` or `StoreModule.forRoot()` that initializes your store.
:::

## Configuration options

| Option | Type | Default | Description |
|---|---|---|---|
| `wsUrl` | `string` | `'ws://localhost:4000'` | WebSocket server URL |
| `trackEffects` | `boolean` | `true` | Enable effect lifecycle tracking |

## AI assistant configuration

Let GitHub Copilot or another AI assistant configure NgRx DevTool for you automatically using the `agent.md` file, which contains complete setup instructions.

```bash
git clone https://github.com/adxdits/ngrx-devtool-agent.git
```

Then ask your AI assistant:

- *"Configure NgRx DevTool using agent.md"*
- *"Set up NgRx DevTool with standalone configuration"*
- *"Set up NgRx DevTool with NgModule configuration"*
