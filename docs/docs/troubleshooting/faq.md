---
sidebar_position: 2
title: FAQ
---

# Frequently Asked Questions

### Is NgRx DevTool compatible with the Redux DevTools extension?

No. NgRx DevTool is a standalone solution that doesn't require any browser extensions. It provides a native Angular experience with a dedicated UI at `http://localhost:3000`.

---

### Can I use this in production?

Yes, but it is recommended to conditionally include the DevTools based on your environment:

```typescript
providers: [
  ...(!environment.production ? [
    provideNgrxDevTool({ wsUrl: 'ws://localhost:4000' })
  ] : [])
]
```

---

### What do the color indicators mean?

When viewing actions in the DevTool UI:

- **Blue border** - User action (dispatched directly)
- **Orange border** - Effect result (shows which effect emitted the action)

---

### Does it support NgModule-based apps?

Yes. If you have a separate store module (common in enterprise apps), configure it like this:

```typescript
// store.module.ts
@NgModule({
  imports: [
    StoreModule.forRoot(
      { /* reducers */ },
      { metaReducers: [createDevToolMetaReducer()] }
    ),
    EffectsModule.forRoot([...])
  ]
})
export class RootStoreModule {}

// app.config.ts
providers: [
  provideNgrxDevTool({ wsUrl: 'ws://localhost:4000' }),
]
```

---

### How much overhead does it add?

The DevTool is designed to be lightweight. When the panel is closed, overhead is minimal. You can disable features like `trackEffects: false` to further reduce it.

---

### What ports does the DevTool use?

By default:

- `:3000` - DevTool UI
- `:4000` - WebSocket server for communication

---

### Can I contribute?

Yes, the project is open source:

1. Fork the repository.
2. Make your changes.
3. Test with the demo app: `ng serve ngrx-devtool-demo`
4. Submit a pull request.
