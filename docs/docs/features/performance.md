---
sidebar_position: 3
title: Performance Metrics
---

# Performance Metrics

Track render time for every state change in your Angular application.

## How it works

The `PerformanceTrackerService` measures the actual time it takes for Angular to render after each state change using Angular's `afterNextRender()` hook.

### Implementation

1. **Start Timer** - When a reducer executes, `performance.now()` is recorded.
2. **Execute Reducer** - The state update happens normally.
3. **Wait for Render** - `afterNextRender()` schedules a callback after Angular's change detection completes.
4. **Calculate Duration** - The difference gives the actual render time.

```typescript
measureRenderTime(actionType, reducer, callback) {
  const startTime = performance.now();
  const nextState = reducer();

  afterNextRender(() => {
    const renderTime = performance.now() - startTime;
    callback(renderTime);
  });

  return nextState;
}
```

## Render time thresholds

| Badge | Range | Meaning |
|---|---|---|
| Fast | < 16ms | Smooth 60fps performance |
| Moderate | 16–50ms | May cause slight jank |
| Slow | > 50ms | Noticeable frame drops |

## Why 16ms?

For smooth 60fps animations, each frame must complete in ~16.67ms. Renders exceeding this threshold cause dropped frames and visible stuttering.

:::tip
If you see consistent slow renders, consider using `OnPush` change detection, breaking up large components, or virtualizing long lists.
:::
