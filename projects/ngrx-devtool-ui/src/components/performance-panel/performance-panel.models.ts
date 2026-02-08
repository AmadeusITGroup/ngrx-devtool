export interface RenderPerformance {
  renderTime: number;
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
}

export interface RenderStats {
  avgRenderTime: number;
  maxRenderTime: number;
  totalActions: number;
}

export const STATUS_COLORS = {
  good: '#4caf50',
  warning: '#ff9800',
  critical: '#f44336',
} as const;

export const OPTIMIZATION_TIPS = [
  { threshold: 32, text: 'Use OnPush change detection strategy', docUrl: 'https://angular.dev/best-practices/skipping-subtrees#using-onpush' },
  { threshold: 50, text: 'Add trackBy to *ngFor loops', docUrl: 'https://angular.dev/api/common/NgFor#description' },
  { threshold: 100, text: 'Use virtual scrolling for large lists', docUrl: 'https://material.angular.io/cdk/scrolling/overview#virtual-scrolling' },
  { threshold: 100, text: 'Defer heavy components with @defer', docUrl: 'https://angular.dev/guide/defer' },
  { threshold: 150, text: 'Use signals for fine-grained reactivity', docUrl: 'https://angular.dev/guide/signals' },
];

export const METRIC_TOOLTIPS = {
  avgRenderTime: `Average Render Time

Formula: Sum of all render times ÷ Total actions

How it's measured:
• Timer starts when action is dispatched
• Timer ends when afterNextRender() fires
• afterNextRender() executes after Angular completes change detection and DOM updates

This represents the average time Angular takes to re-render components after each state change.`,

  maxRenderTime: `Maximum Render Time

Formula: Max(all render times)

The slowest render recorded across all tracked actions. High values indicate specific actions that cause expensive re-renders.

Target: < 16ms for 60fps, < 32ms acceptable`,

  totalActions: `Total Actions Tracked

The number of NgRx actions that triggered a state change and were measured for render performance.

Only STATE_CHANGE messages with renderPerformance data are counted.`,

  renderTime: `Render Time

How it's measured:
1. Action dispatched → Timer starts
2. Reducer executes (state updates)
3. Angular runs change detection
4. Components re-render, DOM updates
5. afterNextRender() fires → Timer ends

This captures the full render cycle from action to painted pixels.`,

  status: `Performance Status

• Good (green): ≤ 16ms - Within 60fps frame budget
• Warning (yellow): 16-32ms - May cause occasional jank
• Critical (red): > 32ms - Will cause visible stuttering

The 16ms budget comes from 1000ms ÷ 60fps = 16.67ms per frame.`,
} as const;
