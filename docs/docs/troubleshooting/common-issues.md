---
sidebar_position: 1
title: Common Issues
---

# Troubleshooting

## npm link issues {#npm-link-issues}

If you get module resolution errors after `npm link`, you need to enable symlink preservation.

:::note
This is required for Nx/Angular monorepo projects.
:::

**Step 1:** Build and link the library:

```bash
# In the ngrx-devtool directory
ng build ngrx-devtool
cd dist/ngrx-devtool
npm link

# Then in YOUR project directory
npm link @amadeus-it-group/ngrx-devtool
```

**Step 2:** Configure symlink preservation.

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "preserveSymlinks": true
  }
}
```

In `angular.json` (build options):

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

After running `npm install`, you may need to re-run `npm link @amadeus-it-group/ngrx-devtool`.

---

## Build errors with `@types/jest` and `@types/jasmine`

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

---

## Only effects showing, no actions

Your meta-reducer is likely being overridden.

**Solution:** Make sure `createDevToolMetaReducer()` is added to the `StoreModule.forRoot()` or `provideStore()` that actually initializes your store (not a duplicate).

```typescript
// Correct - add to the actual store initialization
provideStore(
  { /* your reducers */ },
  { metaReducers: [createDevToolMetaReducer()] }
)
```

---

## Effects not being tracked

Ensure you have:

1. Added `provideNgrxDevTool({ trackEffects: true })` to your providers.
2. Called `provideEffects([...])` **before** `provideNgrxDevTool()`.

```typescript
providers: [
  provideStore(...),
  provideEffects([YourEffects]),  // Must come first
  provideNgrxDevTool({ trackEffects: true }),
]
```

---

## WebSocket connection issues

- Ensure the DevTool server is running before starting your Angular app.
- Check that ports 3000 and 4000 are not in use by other processes.

---

## Port already in use

If you get `EADDRINUSE: address already in use`, kill the existing process:

```bash
# Kill process on port 4000
lsof -ti :4000 | xargs kill -9

# Kill process on port 3000
lsof -ti :3000 | xargs kill -9
```
