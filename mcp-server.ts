import type { Express, Request, Response, json as expressJson } from 'express';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const MAX_ENTRIES = 500;

type JsonObject = Record<string, unknown>;
type RpcId = string | number | null;

interface PerformanceWarningLike {
  message?: string;
}

interface CapturedStateChange {
  type: 'STATE_CHANGE';
  action?: { type?: string };
  nextState?: unknown;
  isEffectResult?: boolean;
  effectName?: string;
  timestamp?: string;
  performance?: { warnings?: PerformanceWarningLike[] };
  renderPerformance?: { renderTime?: number };
  renderTiming?: { totalTime?: number };
  appName?: string;
}

interface CapturedEffect {
  type: 'EFFECT_EVENT';
  action?: string;
  effectName?: string;
  effectEvent?: {
    name?: string;
    lifecycle?: string;
    duration?: number;
    dispatch?: boolean;
    errorMessage?: string;
    errorStack?: string;
  };
  timestamp?: string;
  appName?: string;
}

interface CapturedTiming {
  type: 'RENDER_TIMING';
  actionType?: string;
  reducerTime?: number;
  renderTime?: number;
  totalTime?: number;
  timestamp?: string;
  appName?: string;
}

type CapturedMessage =
  | CapturedStateChange
  | CapturedEffect
  | CapturedTiming
  | { type: 'TIMELINE_CLEARED' | 'CLEAR_REQUEST'; appName?: string };

export interface DevToolStore {
  actions: CapturedStateChange[];
  effects: CapturedEffect[];
  timings: CapturedTiming[];
  appName?: string;
  clearCount: number;
  lastClearedAt?: string;
}

export function createStore(): DevToolStore {
  return { actions: [], effects: [], timings: [], clearCount: 0 };
}

function push<T>(arr: T[], item: T): void {
  arr.push(item);
  if (arr.length > MAX_ENTRIES) arr.shift();
}

export function captureMessage(store: DevToolStore, raw: unknown): void {
  let msg: unknown;
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
  } catch {
    return;
  }
  if (!isCapturedMessage(msg)) return;

  if (typeof msg.appName === 'string') store.appName = msg.appName;

  switch (msg.type) {
    case 'STATE_CHANGE':
      // NgRx dispatches @ngrx/store/init exactly once per app bootstrap. Treat
      // it as the start of a fresh session and drop data from previous runs, so
      // the MCP view tracks the current app session instead of accumulating
      // stale actions/effects across reloads (which drifts from the live UI).
      if (msg.action?.type === '@ngrx/store/init') {
        store.actions.length = 0;
        store.effects.length = 0;
        store.timings.length = 0;
      }
      push(store.actions, msg);
      break;
    case 'EFFECT_EVENT':
      push(store.effects, msg);
      break;
    case 'RENDER_TIMING':
      push(store.timings, msg);
      break;
    case 'TIMELINE_CLEARED':
    case 'CLEAR_REQUEST':
      clearStore(store, 'websocket');
      break;
    default:
      break;
  }
}

function clearStore(store: DevToolStore, source: string): { clearedAt: string; clearCount: number; source: string } {
  store.actions.length = 0;
  store.effects.length = 0;
  store.timings.length = 0;
  store.clearCount += 1;
  store.lastClearedAt = new Date().toISOString();
  return { clearedAt: store.lastClearedAt, clearCount: store.clearCount, source };
}

interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

function diffStates(before: unknown, after: unknown, base = '', out: DiffEntry[] = []): DiffEntry[] {
  if (out.length >= 100) return out;
  if (before === after) return out;

  const bothObjects =
    isIndexable(before) && isIndexable(after) &&
    !Array.isArray(before) === !Array.isArray(after);

  if (!bothObjects) {
    out.push({ path: base || '(root)', before, after });
    return out;
  }

  const beforeRecord = before as JsonObject;
  const afterRecord = after as JsonObject;
  const keys = Object.keys(beforeRecord);
  for (const k of Object.keys(afterRecord)) {
    if (!(k in beforeRecord)) keys.push(k);
  }
  for (const key of keys) {
    const path = base ? `${base}.${key}` : key;
    if (!(key in beforeRecord)) {
      out.push({ path, before: undefined, after: afterRecord[key] });
    } else if (!(key in afterRecord)) {
      out.push({ path, before: beforeRecord[key], after: undefined });
    } else {
      diffStates(beforeRecord[key], afterRecord[key], path, out);
    }
    if (out.length >= 100) break;
  }
  return out;
}

function actionType(msg: CapturedStateChange): string {
  return msg?.action?.type ?? '[unknown]';
}

/**
 * Raw STATE_CHANGE messages don't know whether an action was dispatched by a
 * user or emitted by an effect. Reconstruct that link from the EFFECT_EVENT
 * stream: any action that an effect "emitted" is effect-sourced. Mirrors the
 * correlation the UI does in `messagesWithPrevState`.
 */
function buildEffectActionMap(store: DevToolStore): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of store.effects) {
    if (e.effectEvent?.lifecycle === 'emitted' && e.action) {
      map.set(e.action, e.effectName ?? e.effectEvent.name ?? 'effect');
    }
  }
  return map;
}

function getActionTimeline(store: DevToolStore, limit: number): unknown {
  const effectMap = buildEffectActionMap(store);
  const items = store.actions.slice(-limit).map((m) => {
    const type = actionType(m);
    const effectName = m.effectName ?? effectMap.get(type);
    return {
      type,
      source: m.isEffectResult || effectMap.has(type) ? 'effect' : 'user',
      effectName,
      timestamp: m.timestamp,
      renderTimeMs: m.renderTiming?.totalTime ?? m.renderPerformance?.renderTime,
      warnings: m.performance?.warnings?.map((w) => w.message),
    };
  });
  return { totalCaptured: store.actions.length, returned: items.length, actions: items };
}

function getEffects(store: DevToolStore, limit: number): unknown {
  const items = store.effects.slice(-limit).map((m) => ({
    effect: m.effectName ?? m.effectEvent?.name,
    lifecycle: m.effectEvent?.lifecycle,
    resultAction: m.action,
    durationMs: m.effectEvent?.duration,
    dispatch: m.effectEvent?.dispatch,
    timestamp: m.timestamp,
    errorMessage: m.effectEvent?.errorMessage,
  }));
  return { totalCaptured: store.effects.length, returned: items.length, effects: items };
}

function getEffectErrors(store: DevToolStore): unknown {
  const errors = store.effects
    .filter((m) => m.effectEvent?.lifecycle === 'error')
    .map((m) => ({
      effect: m.effectName ?? m.effectEvent?.name,
      triggerAction: m.action,
      timestamp: m.timestamp,
      errorMessage: m.effectEvent?.errorMessage,
      errorStack: m.effectEvent?.errorStack,
    }));
  return { count: errors.length, errors };
}

function getCurrentState(store: DevToolStore): unknown {
  const last = store.actions[store.actions.length - 1];
  if (!last) return { state: null, note: 'No state captured yet.' };
  return { afterAction: actionType(last), timestamp: last.timestamp, state: last.nextState };
}

function getStateDiff(store: DevToolStore, target?: string): unknown {
  let index = store.actions.length - 1;
  if (target) {
    const found = store.actions.map(actionType).lastIndexOf(target);
    if (found >= 0) index = found;
    else return { error: `No captured action of type "${target}".` };
  }
  if (index < 0) return { error: 'No actions captured yet.' };

  const current = store.actions[index];
  const previous = index > 0 ? store.actions[index - 1] : undefined;
  const changes = diffStates(previous?.nextState, current.nextState);
  return {
    action: actionType(current),
    timestamp: current.timestamp,
    changedPaths: changes.length,
    changes,
  };
}

function getPerformanceStats(store: DevToolStore): unknown {
  const times = store.actions
    .map((m) => ({ type: actionType(m), ms: m.renderTiming?.totalTime ?? m.renderPerformance?.renderTime }))
    .filter((t) => typeof t.ms === 'number');

  if (times.length === 0) return { note: 'No render timings captured yet.' };

  const values = times.map((t) => t.ms as number);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const slowest = [...times].sort((a, b) => (b.ms as number) - (a.ms as number)).slice(0, 5);
  const overBudget = times.filter((t) => (t.ms as number) > 16).length;

  return {
    measuredActions: times.length,
    avgRenderMs: Number(avg.toFixed(2)),
    maxRenderMs: Number(max.toFixed(2)),
    overFrameBudget16ms: overBudget,
    slowest,
  };
}

function getDebugSummary(store: DevToolStore): unknown {
  const errors = getEffectErrors(store) as { errors: unknown[] };
  const perf = getPerformanceStats(store);
  const effectMap = buildEffectActionMap(store);
  const recent = store.actions.slice(-10).map((m) => {
    const type = actionType(m);
    const effectName = m.effectName ?? effectMap.get(type);
    return effectName ? `${type} (via ${effectName})` : type;
  });
  const effectExecutions = store.effects.filter((e) => e.effectEvent?.lifecycle === 'emitted').length;
  return {
    appName: store.appName,
    totalActions: store.actions.length,
    totalEffectEvents: store.effects.length,
    effectExecutions,
    effectErrorCount: errors.errors.length,
    clearCount: store.clearCount,
    lastClearedAt: store.lastClearedAt,
    recentActions: recent,
    effectErrors: errors.errors,
    performance: perf,
    hint:
      'Use get_state_diff(actionType) to inspect what changed for a specific action, ' +
      'get_effects to see the effect chain, and get_current_state for the latest store snapshot.',
  };
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonObject;
  run: (store: DevToolStore, args: JsonObject) => unknown;
}

const TOOLS: ToolDef[] = [
  {
    name: 'get_debug_summary',
    description:
      'High-level health snapshot of the live NgRx session: recent actions, effect errors and render performance. Start here when debugging.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => getDebugSummary(store),
  },
  {
    name: 'get_action_timeline',
    description: 'Recent dispatched actions with source (user/effect), render time and any performance warnings.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max actions to return (default 25).' } },
    },
    run: (store, args) => getActionTimeline(store, clampLimit(args?.limit, 25)),
  },
  {
    name: 'get_effects',
    description: 'Recent NgRx effect executions (lifecycle, duration, result action).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max effect events to return (default 25).' } },
    },
    run: (store, args) => getEffects(store, clampLimit(args?.limit, 25)),
  },
  {
    name: 'get_effect_errors',
    description: 'All captured effect errors with message and stack trace. Use when an effect is failing.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => getEffectErrors(store),
  },
  {
    name: 'get_state_diff',
    description:
      'What changed in the store for an action. Pass an actionType to target a specific action, or omit for the most recent.',
    inputSchema: {
      type: 'object',
      properties: { actionType: { type: 'string', description: 'Action type to diff (optional).' } },
    },
    run: (store, args) => getStateDiff(store, typeof args?.actionType === 'string' ? args.actionType : undefined),
  },
  {
    name: 'get_current_state',
    description: 'The latest full store snapshot captured by the DevTool.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => getCurrentState(store),
  },
  {
    name: 'get_performance_stats',
    description: 'Render-timing aggregates: average/max render time and the slowest actions.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => getPerformanceStats(store),
  },
  {
    name: 'clear_debug_session',
    description: 'Clear the MCP capture history for the current NgRx DevTool session.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => clearStore(store, 'mcp-tool'),
  },
];

function clampLimit(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_ENTRIES);
}

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

interface RpcRequest {
  jsonrpc: '2.0';
  id?: RpcId;
  method: string;
  params?: JsonObject;
}

type RpcResponse = ReturnType<typeof rpcResult> | ReturnType<typeof rpcError>;

function handleRpc(rpc: unknown, store: DevToolStore): RpcResponse | null {
  if (!isRpcRequest(rpc)) {
    return isIndexable(rpc) && isRpcId(rpc.id) ? rpcError(rpc.id, -32600, 'Invalid Request') : null;
  }

  const { id, method, params } = rpc;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion:
          typeof params?.protocolVersion === 'string' ? params.protocolVersion : MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'ngrx-devtool', version: '1.0.0' },
        instructions:
          'Query the live NgRx DevTool session. Call get_debug_summary first, then drill in with the other tools.',
      });

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return isNotification ? null : rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });

    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const args = isIndexable(params?.arguments) ? params.arguments : {};
        const data = tool.run(store, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        });
      } catch (err: unknown) {
        return rpcResult(id, {
          content: [{ type: 'text', text: `Tool error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }

    default:
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export function registerMcpEndpoint(
  app: Express,
  express: { json: typeof expressJson },
  store: DevToolStore
): void {
  const jsonBody = express.json({ limit: '8mb' });

  const setCors = (res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, mcp-protocol-version');
  };

  app.options('/mcp', (_req: Request, res: Response) => {
    setCors(res);
    res.status(204).end();
  });

  app.post('/mcp', jsonBody, (req: Request, res: Response) => {
    setCors(res);
    const body = req.body;
    try {
      if (Array.isArray(body)) {
        const responses = body.map((rpc) => handleRpc(rpc, store)).filter((r) => r !== null);
        if (responses.length === 0) return res.status(202).end();
        return res.json(responses);
      }
      const response = handleRpc(body, store);
      if (response === null) return res.status(202).end();
      return res.json(response);
    } catch (err: unknown) {
      const id = isIndexable(body) && isRpcId(body.id) ? body.id : null;
      return res.status(500).json(rpcError(id, -32603, err instanceof Error ? err.message : 'Internal error'));
    }
  });

  app.get('/mcp', (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json(rpcError(null, -32000, 'Method Not Allowed: this server only supports POST /mcp'));
  });

  app.delete('/mcp', (_req: Request, res: Response) => {
    setCors(res);
    clearStore(store, 'mcp-delete');
    res.status(200).end();
  });
}

function isIndexable(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object';
}

function isRpcId(value: unknown): value is RpcId {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

function isRpcRequest(value: unknown): value is RpcRequest {
  return (
    isIndexable(value) &&
    value.jsonrpc === '2.0' &&
    typeof value.method === 'string' &&
    (value.id === undefined || isRpcId(value.id)) &&
    (value.params === undefined || isIndexable(value.params))
  );
}

function isCapturedMessage(value: unknown): value is CapturedMessage {
  return isIndexable(value) && typeof value.type === 'string';
}
