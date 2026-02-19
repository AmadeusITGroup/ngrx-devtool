<p align="center">
  <img src="assets/amadeus.png" alt="Amadeus Logo" width="120">
</p>

<h1 align="center">NgRx DevTool</h1>

<p align="center">
  <strong>Architecture Visualization Tool</strong><br>
  A powerful development tool for visualizing and debugging NgRx state management in Angular applications.
  <br>Features real-time effect lifecycle tracking and performance monitoring.
</p>

---

## Overview

This tool provides real-time monitoring and visualization of NgRx actions, state changes, and effects. It tracks effect lifecycle events (started, emitted, completed, error) and correlates actions with the effects that emitted them.

![NgRx DevTool Demo](assets/devtool-on-pct.gif)

## Features

- **Real-time Action Monitoring** - Track all dispatched actions as they happen
- **Effect Lifecycle Tracking** - Monitor effect execution with start, emit, complete, and error events
- **Action-Effect Correlation** - See which effect emitted each action
- **State Visualization** - View current and previous states
- **Diff Viewer** - Compare state changes between actions
- **Visual Indicators** - Blue for user actions, orange for effect results
- **Performance Tracking** - Monitor reducer execution time, render timing, and state size changes
- **Effects Panel** - Dedicated panel showing all effect executions with duration and status
- **Selector Tracking** *(coming soon)* - Track selector invocations, cache hit rates, and recomputation metrics (APIs already implemented: `trackSelector`, `createTrackedSelector`, `SelectorTrackerService`)

## Project Structure

- **ngrx-devtool** - Core library package
- **ngrx-devtool-ui** - Standalone visualization UI  
- **ngrx-devtool-demo** - Example implementation

---

## Quick Start

### Step 1: Clone and build

Since the package is not yet published to npm, use the development setup:

```bash
git clone <repository-url>
cd ngrx-devtool
npm install
npm run build
```

### Step 2: Link the library to your project

```bash
cd dist/ngrx-devtool
npm link

# In your Angular project directory
npm link ngrx-devtool
```

Note: If you encounter module resolution issues, see the npm Link Issues section in Troubleshooting.

### Step 3: Configure your app

**Option A: Standalone (recommended)**

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

**Option B: NgModule with separate store module** (common in large enterprise apps)

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

// app.config.ts
import { provideNgrxDevTool } from 'ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    // Don't add provideStore() here - RootStoreModule already has it
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
};
```

> [!WARNING]
> The `createDevToolMetaReducer()` must be added to the same `provideStore()` or `StoreModule.forRoot()` that initializes your store. If you're only seeing effects in the DevTool (no actions), you likely have a separate store module see Option B above.

Note: If your app fails to compile or run after this step, see the npm Link Issues section in Troubleshooting to configure `preserveSymlinks`.

### Step 4: Run the DevTool server

```bash
# From the ngrx-devtool-proto directory
node dist/index.js
```

### Step 5: Open the DevTool UI

Open http://localhost:3000 and start your Angular app. All actions will appear:
- Blue border = User action
- Orange border = Effect result (shows which effect emitted the action)

---

## Troubleshooting

### npm Link Issues

If you get module resolution errors after `npm link`, you need to enable symlink preservation.

Note: This is required for Nx/Angular monorepo projects.

**Step 1:** Build and link the library first:
```bash
# In the ngrx-devtool directory
ng build ngrx-devtool
cd dist/ngrx-devtool
npm link

# Then in YOUR project directory
npm link ngrx-devtool
```

**Step 2:** Configure symlink preservation:

tsconfig.json:
```json
{
  "compilerOptions": {
    "preserveSymlinks": true
  }
}
```

angular.json (in build options):
```json
{
  "architect": {
    "build": {
      "options": {
        "preserveSymlinks": true
      }
    }
  }
}
```

Note: After running `npm install`, you may need to re-run `npm link ngrx-devtool`.

### Build Errors with @types/jest and @types/jasmine

If you see TypeScript errors like:
```
error TS2428: All declarations of 'ArrayContaining' must have identical type parameters
```

This is caused by having both `@types/jest` and `@types/jasmine` installed. Remove the one you're not using:

```bash
# If using Jest (recommended)
npm uninstall @types/jasmine

# If using Jasmine
npm uninstall @types/jest
```

### Only effects showing, no actions

Your meta reducer is likely being overridden. Make sure `createDevToolMetaReducer()` is added to the `StoreModule.forRoot()` or `provideStore()` that actually initializes your store (not a duplicate).

### Effects not being tracked

Ensure you have:
1. Added `provideNgrxDevTool({ trackEffects: true })` to your providers
2. Called `provideEffects([...])` before `provideNgrxDevTool()`

### WebSocket connection issues

- Ensure the DevTool server is running (`node dist/index.js`) before starting your Angular app
- Check that ports 3000 and 4000 are not in use by other processes

### Port already in use

If you get `EADDRINUSE: address already in use`, kill the existing process:

```bash
# Kill process on port 4000
lsof -ti :4000 | xargs kill -9

# Kill process on port 3000
lsof -ti :3000 | xargs kill -9
```

---

## Contributing

1. Fork the repository
2. Make your changes
3. Test with the demo app: `ng serve ngrx-devtool-demo`
4. Submit a pull request





