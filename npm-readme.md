# NgRx DevTool

A development tool for visualizing and debugging NgRx state management in Angular applications. Real-time action monitoring, effect tracking, state visualization, diff viewer, and performance metrics — no browser extensions needed.

## Install

```bash
npm install ngrx-devtool
```

> If your project uses a private npm registry and you get an E401 error:
> ```bash
> npm install ngrx-devtool --registry=https://registry.npmjs.org/
> ```

## Setup

```typescript
// app.config.ts
import { provideNgrxDevTool, createDevToolMetaReducer } from 'ngrx-devtool';

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

> **If you have a separate store module** (e.g. `RootStoreModule`), add `createDevToolMetaReducer()` inside that module's `StoreModule.forRoot()`, not in `app.config.ts`:
>
> ```typescript
> // store.module.ts
> @NgModule({
>   imports: [
>     StoreModule.forRoot(
>       { /* your reducers */ },
>       { metaReducers: [createDevToolMetaReducer()] }
>     ),
>     EffectsModule.forRoot([YourEffects])
>   ]
> })
> export class RootStoreModule {}
>
> // app.config.ts - only add the devtool provider here
> providers: [
>   provideNgrxDevTool({ wsUrl: 'ws://localhost:4000', trackEffects: true }),
> ]
> ```

## Run

```bash
npx ngrx-devtool
```

> If your project uses a private registry:
> ```bash
> npm_config_registry=https://registry.npmjs.org/ npx ngrx-devtool
> ```

Open [http://localhost:3000](http://localhost:3000) and start your Angular app.

## GitHub

[github.com/amadeusitgroup/ngrx-devtool](https://github.com/amadeusitgroup/ngrx-devtool)

## License

MIT
