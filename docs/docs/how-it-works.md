---
sidebar_position: 3
title: How It Works
---

# How It Works

NgRx DevTool consists of three main components working together to capture your application's state flow.

## Architecture

```
Meta-Reducer  →  Effect Sources  →  DevTool UI
```

1. **Meta-Reducer** - Wraps your reducers to capture state changes and broadcast them via WebSocket.
2. **Effect Sources** - Extends NgRx to instrument effects and track their execution lifecycle.
3. **DevTool UI** - Receives data on port 4000 and visualizes it at `localhost:3000`.

## Action tracking

The meta-reducer and Actions stream interception work together to capture every dispatched action. [Learn more →](./features/action-monitoring)

## Effect tracking

`DevToolsEffectSources` instruments effects at registration time to monitor their lifecycle. [Learn more →](./features/effect-tracking)

## Performance calculation

Render time and impact scores are measured using Angular's `afterNextRender()` API. [Learn more →](./features/performance)
