<p align="center">
  <img src="assets/amadeus.png" alt="Amadeus Logo" width="120">
</p>

<h1 align="center">NgRx DevTool</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@amadeus-it-group/ngrx-devtool"><img src="https://img.shields.io/npm/v/@amadeus-it-group/ngrx-devtool?color=cb0000&label=npm&logo=npm" alt="npm"></a>
  <img src="https://img.shields.io/badge/Angular-19+-dd0031?logo=angular&logoColor=white" alt="Angular">
  <img src="https://img.shields.io/badge/NgRx-21+-ba2bd2?logo=ngrx&logoColor=white" alt="NgRx">
  <a href="https://github.com/amadeusitgroup/ngrx-devtool/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
</p>

<p align="center">
  A development tool for visualizing and debugging NgRx state management in Angular applications.<br>
  Real-time action monitoring, effect tracking, state visualization, diff viewer, and performance metrics no browser extensions needed.
</p>

<p align="center">
  <a href="https://amadeusitgroup.github.io/ngrx-devtool/"><strong>Documentation</strong></a>
</p>

---

<p align="center">
  <img src="assets/devtool-on-pct.gif" alt="NgRx DevTool Demo" width="800">
</p>

---

## Quick Start

### 1. Install

```bash
npm install @amadeus-it-group/ngrx-devtool
```

### 2. Configure your app

```typescript
// app.config.ts
import { provideNgrxDevTool, createDevToolMetaReducer } from '@amadeus-it-group/ngrx-devtool';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(
      { /* your reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    provideEffects([YourEffects]),
    provideNgrxDevTool({
      wsUrl: 'ws://localhost:4000',
      trackEffects: true,
    }),
  ]
};
```

### 3. Run the DevTool server

```bash
npx ngrx-devtool
```

### 4. Open the UI

Open **http://localhost:3000** and start your Angular app.

---

For full documentation, configuration options, troubleshooting, and more, visit the **[documentation site](https://amadeusitgroup.github.io/ngrx-devtool/)**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.





