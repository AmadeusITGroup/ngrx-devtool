---
sidebar_position: 1
title: Quick Start
---

# Quick Start

Get NgRx DevTool running in under 5 minutes.

## Step 1: Run the DevTool server

```bash
npx ngrx-devtool
```

:::note
If your project uses a private registry:

```bash
npm_config_registry=https://registry.npmjs.org/ npx ngrx-devtool
```
:::

## Step 2: Open the DevTool UI

Navigate to [http://localhost:3000](http://localhost:3000)

## Step 3: Start your Angular app

```bash
ng serve
```

## Step 4: View actions in the DevTool

All actions will appear with visual indicators:

- **Blue** - User action (dispatched directly from a component or service)
- **Orange** - Effect result (shows which effect emitted the action)
