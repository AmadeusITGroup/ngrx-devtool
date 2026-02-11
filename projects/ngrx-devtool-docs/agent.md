# NgRx DevTool Configuration Guide for AI Assistants

When a user asks you to configure or set up NgRx DevTool in their Angular project, follow these instructions.

## Prerequisites

1. Install the package:
```bash
npm install ngrx-devtool
```

2. Ensure the DevTool server is running (in a separate terminal):
```bash
cd ngrx-devtool
node dist/index.js
```

---

## Option A: Standalone Configuration (Recommended)

Use this for modern Angular apps using standalone components and `app.config.ts`.

### Step 1: Update `app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideNgrxDevTool, createDevToolMetaReducer } from 'ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      { /* your reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    provideEffects([/* YourEffects */]),
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
};
```

### Important Notes for Standalone:
- `provideEffects()` must come **before** `provideNgrxDevTool()` for effect tracking to work
- `createDevToolMetaReducer()` must be in the same `provideStore()` call that initializes the store

---

## Option B: NgModule Configuration

Use this for apps using the traditional NgModule pattern, especially enterprise apps with a separate store module.

### Step 1: Update the Store Module

```typescript
// store.module.ts
import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { createDevToolMetaReducer } from 'ngrx-devtool';

@NgModule({
  imports: [
    StoreModule.forRoot(
      { /* your reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    EffectsModule.forRoot([/* YourEffects */])
  ]
})
export class RootStoreModule {}
```

### Step 2: Add the DevTool provider in `app.config.ts` or `app.module.ts`

```typescript
// app.config.ts (if using hybrid approach)
import { provideNgrxDevTool } from 'ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
};
```

Or in `app.module.ts`:

```typescript
import { provideNgrxDevTool } from 'ngrx-devtool';

@NgModule({
  imports: [RootStoreModule],
  providers: [
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
})
export class AppModule {}
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wsUrl` | string | `'ws://localhost:4000'` | WebSocket server URL for DevTool communication |
| `trackEffects` | boolean | `true` | Enable effect lifecycle tracking |

---

## Production Considerations

To exclude DevTools from production builds:

```typescript
import { environment } from './environments/environment';

providers: [
  ...(!environment.production ? [
    provideNgrxDevTool({ wsUrl: 'ws://localhost:4000' })
  ] : [])
]
```

---

## Common Issues

1. **Effects not tracked**: Ensure `provideEffects()` is called **before** `provideNgrxDevTool()`
2. **Actions not showing**: Make sure `createDevToolMetaReducer()` is in the correct `provideStore()` or `StoreModule.forRoot()`
3. **Connection failed**: Verify the DevTool server is running on port 4000

---

## Ports Used

- `:3000` - DevTool UI (open in browser)
- `:4000` - WebSocket server (configured in `wsUrl`)
