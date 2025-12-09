# NgRx DevTool - Architecture Visualization Tool

A powerful development tool for visualizing and debugging NgRx state management in Angular applications. Features **automatic effect detection** and **action correlation tracking**.

## Overview

This tool provides real-time monitoring and visualization of NgRx actions, state changes, and effects. It automatically detects which actions are dispatched by effects and correlates them back to their triggering user actions.

![NgRx DevTool Demo](assets/devtool-on-pct.gif)

## Features

- **Real-time Action Monitoring** - Track all dispatched actions as they happen
- **Automatic Effect Detection** - Distinguishes user actions from effect-dispatched actions
- **Action Correlation** - Links effect results back to their triggering actions
- **State Visualization** - View current and previous states
- **Diff Viewer** - Compare state changes between actions
- **Visual Indicators** - Blue for user actions, orange for effect results
- **WebSocket Integration** - Live connection to development UI

## Project Structure

- **ngrx-devtool** - Core library package (what you install in your app)
- **ngrx-devtool-ui** - Standalone visualization UI  
- **ngrx-devtool-demo** - Example implementation

---

## Quick Start: Use DevTool in Your App

### Step 1: Install the library

```bash
npm install ngrx-devtool
```
> *If not published to npm yet, link it locally from this repo*

### Step 2: Add one line to your app

```typescript
// app.config.ts
import { loggerMetaReducer } from 'ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      { /* your reducers */ },
      { metaReducers: [loggerMetaReducer] }  // ← Add this line
    ),
    provideEffects([/* your effects */]),
    // ... other providers
  ]
};
```

### Step 3: Run the DevTool server

```bash
# From the ngrx-devtool-proto directory
node dist/index.js
```

### Step 4: Open the DevTool UI

Open your browser to **http://localhost:3000**

### Step 5: Run your app and see actions

Start your Angular app and interact with it. All actions will appear in the DevTool UI:
- 🔵 **Blue border** = User action
- 🟠 **Orange border** = Effect result (with "Triggered by" info)

---

## Development Setup (Contributing to DevTool)

If you want to develop or modify the DevTool itself:

### 1. Clone and install
```bash
git clone <repository-url>
cd ngrx-devtool-proto
npm install
```

### 2. Build everything
```bash
npm run build
```

### 3. Start the DevTool server + UI
```bash
node dist/index.js
```
UI available at **http://localhost:3000**

### 4. Run the demo app (to test)
```bash
ng serve ngrx-devtool-demo
```
Demo app at **http://localhost:4200**

---

## How Effect Tracking Works

The DevTool doesn't parse your effect classes. Instead, it detects effect-dispatched actions by **pattern matching on action names**:

| Pattern | Example | Detected As |
|---------|---------|-------------|
| `[* API *]` | `[Books API] Retrieved Book List` | Effect |
| `[* Service *]` | `[Auth Service] Login Success` | Effect |
| `*Success` | `loadBooksSuccess` | Effect |
| `*Failure` | `loadBooksFailure` | Effect |
| `*Error` | `fetchDataError` | Effect |
| `*Complete` | `uploadComplete` | Effect |
| Everything else | `[Books] Load Books` | User Action |

### Recommended Action Naming

For best results, follow this naming convention:

```typescript
// User-initiated actions
export const BooksActions = createActionGroup({
  source: 'Books',  // No "API" suffix
  events: {
    'Load Books': emptyProps(),
    'Add Book': props<{ bookId: string }>(),
  },
});

// Effect-dispatched actions
export const BooksApiActions = createActionGroup({
  source: 'Books API',  // "API" suffix indicates effect result
  events: {
    'Retrieved Book List': props<{ books: Book[] }>(),
    'Load Failed': props<{ error: string }>(),
  },
});
```

## UI Components

The DevTool UI displays:

- **Action List** - Expandable panels for each dispatched action
  - 🔵 Blue border + 👤 icon = User action
  - 🟠 Orange border + ⚡ icon = Effect result
- **Correlation Badge** - Shows "Chain #X" for effect sequences
- **Triggered By** - Shows which user action triggered an effect
- **Tabbed Views** - Action payload, state snapshot, and diff

---

## Advanced Configuration

### Custom WebSocket URL

If your DevTool server runs on a different host/port:

```typescript
import { createDevToolMetaReducer } from 'ngrx-devtool';

provideStore(
  { /* reducers */ },
  { metaReducers: [createDevToolMetaReducer('ws://custom-host:4000')] }
)
```

---

## Troubleshooting

### UI not loading at http://localhost:3000

Run the servers manually in separate terminals:

```bash
# Terminal 1: WebSocket server
node dist/index.js

# Terminal 2: UI server  
cd dist && npx http-server ngrx-devtool-ui/browser -p 3000

# Terminal 3: Your app
ng serve your-app
```

### Actions showing without names

You may have duplicate message sources. Only use `loggerMetaReducer` - don't add `provideNgrxDevTool()`.

### Effects not being detected as effects

Check that your effect action names include `API`, `Service`, `Success`, `Failure`, `Error`, or `Complete`. See the naming patterns table above.

---

## Contributing

We welcome contributions!

1. Fork the repository
2. Follow the installation steps above
3. Make your changes
4. Test with the demo application
5. Submit a pull request





