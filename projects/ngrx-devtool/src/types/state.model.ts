export interface ActionDispatchedPayload {
  actionType: string;
  previousState: Record<string, any>;
  action: Record<string, any>;
  nextState: Record<string, any>;
}

export interface PerformanceMetrics {
  /** Time taken by the reducer to process the action (ms) */
  reducerExecutionTime: number;
  /** Size of the state after the action (bytes) */
  stateSize: number;
  /** Size change from previous state (bytes) */
  stateSizeChange: number;
  /** Memory usage if available */
  memoryUsage?: MemoryInfo;
  /** Action payload size (bytes) */
  actionPayloadSize: number;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceWarning {
  type: PerformanceWarningType;
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
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
  /** Max acceptable reducer execution time (ms) */
  maxReducerTime: number;
  /** Max acceptable state size (bytes) */
  maxStateSize: number;
  /** Max acceptable state change per action (bytes) */
  maxStateChangeSize: number;
  /** Max actions per second before warning */
  maxActionsPerSecond: number;
  /** Max action payload size (bytes) */
  maxPayloadSize: number;
}

export interface ActionTypeStats {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  lastExecuted: number;
}

export interface ActionPerformanceEntry {
  actionType: string;
  timestamp: number;
  metrics: PerformanceMetrics;
  /** Performance warnings for this action */
  warnings: PerformanceWarning[];
}

/** Render impact estimation for a state change */
export interface RenderImpactData {
  /** Impact score (0-100) */
  score: number;
  /** Impact level */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated components affected */
  estimatedComponentsAffected: number;
  /** Factors contributing to impact */
  factors: RenderImpactFactorData[];
  /** Recommendations */
  recommendations: string[];
}

export interface RenderImpactFactorData {
  name: string;
  description: string;
  impact: number;
  details?: string;
}

/** Selector performance metrics */
export interface SelectorMetricsData {
  name: string;
  invocationCount: number;
  recomputationCount: number;
  totalComputationTime: number;
  avgComputationTime: number;
  maxComputationTime: number;
  cacheHitRate: number;
}
