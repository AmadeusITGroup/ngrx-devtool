---
sidebar_position: 2
title: Effect Tracking
---

# Effect Tracking

Monitor effect execution with start, emit, complete, and error events.

## How it works

Effect tracking is powered by `DevToolsEffectSources`, which extends NgRx's `EffectSources` class to instrument effects at registration time.

![Effect Tracking Flow Diagram](/img/effecta-tracking-uml.png)

### Implementation details

1. **Effect Registration Override** - `DevToolsEffectSources` overrides `addEffects()` to intercept effect classes when registered.
2. **Metadata Extraction** - Effect properties are identified by the `__@ngrx/effects_create__` metadata key from `createEffect()`.
3. **Observable Instrumentation** - Each effect's observable is wrapped with `tap()` to capture emissions and errors.
4. **Lifecycle Events** - Events are emitted for: `emitted` (action dispatched), `executed` (non-dispatch effect), `error`.
5. **Duration Calculation** - Time is tracked between emissions to calculate effect duration.
6. **ReplaySubject Buffer** - Events are buffered in a ReplaySubject (100 items) for late subscribers.

## Effect states

| State | Description |
|---|---|
| Started | Effect has begun execution |
| Emitted | Effect has dispatched an action |
| Completed | Effect has finished successfully |
| Error | Effect encountered an error |

## Effects panel

The dedicated Effects Panel shows all effect executions with:

- Effect name and class
- Duration of execution
- Current status
- Actions emitted
- Error details (if any)

:::warning
`provideEffects()` must be called **before** `provideNgrxDevTool()` so effects are registered before the DevTool instruments them.
:::

## Configuration

Ensure effect tracking is enabled:

```typescript
provideNgrxDevTool({
  trackEffects: true
})
```
