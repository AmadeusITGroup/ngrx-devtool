export interface ActionDispatchedPayload {
  readonly actionType: string;
  readonly previousState: Record<string, unknown>;
  readonly action: Record<string, unknown>;
  readonly nextState: Record<string, unknown>;
}

export interface PerformanceMetrics {
  readonly reducerExecutionTime: number;
  readonly stateSize: number;
  readonly stateSizeChange: number;
  readonly memoryUsage?: MemoryInfo;
  readonly actionPayloadSize: number;
}

export interface MemoryInfo {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

export interface PerformanceWarning {
  readonly type: PerformanceWarningType;
  readonly message: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly suggestion?: string;
}

export enum PerformanceWarningType {
  SLOW_REDUCER = 'SLOW_REDUCER',
  LARGE_STATE = 'LARGE_STATE',
  LARGE_STATE_CHANGE = 'LARGE_STATE_CHANGE',
  FREQUENT_ACTIONS = 'FREQUENT_ACTIONS',
  LARGE_PAYLOAD = 'LARGE_PAYLOAD',
  MEMORY_PRESSURE = 'MEMORY_PRESSURE',
  HIGH_RENDER_IMPACT = 'HIGH_RENDER_IMPACT',
}

export interface PerformanceThresholds {
  readonly maxReducerTime: number;
  readonly maxStateSize: number;
  readonly maxStateChangeSize: number;
  readonly maxActionsPerSecond: number;
  readonly maxPayloadSize: number;
}

export interface ActionTypeStats {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  lastExecuted: number;
}

export interface ActionPerformanceEntry {
  readonly actionType: string;
  readonly timestamp: number;
  readonly metrics: PerformanceMetrics;
  readonly warnings: readonly PerformanceWarning[];
}

export interface RenderImpactData {
  readonly score: number;
  readonly level: 'low' | 'medium' | 'high' | 'critical';
  readonly estimatedComponentsAffected: number;
  readonly factors: readonly RenderImpactFactorData[];
  readonly recommendations: readonly string[];
}

export interface RenderImpactFactorData {
  readonly name: string;
  readonly description: string;
  readonly impact: number;
  readonly details?: string;
}

export interface SelectorMetricsData {
  readonly name: string;
  readonly invocationCount: number;
  readonly recomputationCount: number;
  readonly totalComputationTime: number;
  readonly avgComputationTime: number;
  maxComputationTime: number;
  cacheHitRate: number;
}
