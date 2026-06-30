---
sidebar_position: 6
title: Debug with AI
---

# Debug with AI

Turn your live NgRx DevTool session into AI-ready debugging context with no API key, subscription, or extra install required.

## Copy a debugging prompt

Click **Debug with AI** in the toolbar. The DevTool assembles a focused prompt from the current session:

- Recent actions
- Effect errors with stack traces
- Slowest renders
- Latest state diff

Paste the prompt into GitHub Copilot Chat, Claude, ChatGPT, or another assistant. Pick a focus such as health check, debug errors, why slow, or explain flow, and the prompt adapts.

## Run locally with Ollama

If you have [Ollama](https://ollama.com) running, the dialog detects it automatically and lets you ask a local model right inside the DevTool. Answers stream in, and nothing leaves your machine.

```bash
ollama pull llama3
```

## Connect via MCP

The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `http://localhost:3000/mcp`, so AI assistants can query your running NgRx session directly.

Add this to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "ngrx-devtool": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Then ask Copilot Chat things like:

```text
Why is my loadBooks$ effect failing?
```

## MCP tools

| Tool | What it returns |
|---|---|
| `get_debug_summary` | Recent actions, effect errors and performance at a glance |
| `get_action_timeline` | Recent actions with source, render time and warnings |
| `get_effects` / `get_effect_errors` | Effect executions, plus errors with stack traces |
| `get_state_diff` | What changed in the store for a given action |
| `get_current_state` | The latest store snapshot |
| `get_performance_stats` | Average/max render time and the slowest actions |

:::info
The MCP server captures traffic in memory on the DevTool server and adds no new dependencies to the published package.
:::
