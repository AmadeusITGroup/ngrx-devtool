export interface RenderPerformance {
  renderTime: number;
  reducerTime?: number;
  stateSize?: number;
}

export interface PerformanceData {
  reducerExecutionTime: number;
  stateSize: number;
  stateSizeChange: number;
  actionPayloadSize: number;
  warnings?: { severity: string; message: string; suggestion?: string }[];
}

export interface RenderTimingMessage {
  type: 'RENDER_TIMING';
  actionType: string;
  reducerTime: number;
  renderTime: number;
  totalTime: number;
  timestamp: string;
}

export interface StateChangeMessage {
  type: string;
  action: { type: string };
  nextState?: unknown;
  effectName?: string;
  isEffectResult?: boolean;
  timestamp?: string;
  performance?: PerformanceData;
  renderPerformance?: RenderPerformance;
  renderTiming?: RenderTimingMessage;
}

export interface RenderEntry {
  actionType: string;
  renderTime: number;
  reducerTime?: number;
  stateSize?: number;
}

export const STATUS_COLORS = {
  good: '#4caf50',
  warning: '#ff9800',
  critical: '#f44336',
} as const;

export const METRIC_TOOLTIPS = {
  reducerTime: `Reducer Time

Time spent executing the reducer for this action. It excludes Angular change detection and DOM rendering.`,

  renderTime: `Render Time

How it's measured:
1. Action dispatched → Timer starts
2. Reducer executes (state updates)
3. Angular runs change detection
4. Components re-render, DOM updates
5. afterNextRender() fires → Timer ends

This captures the full render cycle from action to painted pixels.`,

  stateSize: `State Size

The UTF-8 byte size of the serialized state immediately after this action.`,

  status: `Performance Status

• Good (green): ≤ 16ms - Within 60fps frame budget
• Warning (yellow): 16-32ms - May cause occasional jank
• Critical (red): > 32ms - Will cause visible stuttering

The 16ms budget comes from 1000ms ÷ 60fps = 16.67ms per frame.`,
} as const;
