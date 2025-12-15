/**
 * Render Impact Estimator
 *
 * Estimates the potential rendering cost based on state changes.
 * This helps developers understand why the Angular Profiler shows
 * slow component rendering even when reducers are fast.
 */

export interface RenderImpactEstimate {
  /** Overall impact score (0-100, higher = more impact) */
  score: number;
  /** Impact level classification */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated components that may re-render */
  estimatedComponentsAffected: number;
  /** Factors contributing to render impact */
  factors: RenderImpactFactor[];
  /** Recommendations to reduce render impact */
  recommendations: string[];
}

export interface RenderImpactFactor {
  name: string;
  description: string;
  impact: number; // 0-100
  details?: string;
}

export interface StateChangeAnalysis {
  /** Number of properties changed at root level */
  rootPropertiesChanged: number;
  /** Total properties changed (deep) */
  totalPropertiesChanged: number;
  /** Arrays that changed size */
  arrayChanges: ArrayChangeInfo[];
  /** Large objects that changed */
  largeObjectChanges: LargeObjectChange[];
  /** Depth of changes */
  maxChangeDepth: number;
}

export interface ArrayChangeInfo {
  path: string;
  previousLength: number;
  newLength: number;
  itemsAdded: number;
  itemsRemoved: number;
}

export interface LargeObjectChange {
  path: string;
  size: number;
  changeType: 'added' | 'modified' | 'replaced';
}

/**
 * Estimate the render impact of a state change.
 */
export function estimateRenderImpact(
  prevState: any,
  nextState: any,
  actionType: string
): RenderImpactEstimate {
  const analysis = analyzeStateChange(prevState, nextState);
  const factors: RenderImpactFactor[] = [];
  let totalScore = 0;

  // Factor 1: Number of root properties changed
  if (analysis.rootPropertiesChanged > 0) {
    const impact = Math.min(analysis.rootPropertiesChanged * 15, 40);
    totalScore += impact;
    factors.push({
      name: 'Root State Changes',
      description: `${analysis.rootPropertiesChanged} top-level state slice(s) changed`,
      impact,
      details: 'Each root change can trigger re-renders in components selecting that slice',
    });
  }

  // Factor 2: Array changes (common cause of heavy re-renders)
  if (analysis.arrayChanges.length > 0) {
    const largestArrayChange = Math.max(...analysis.arrayChanges.map(a => Math.abs(a.newLength - a.previousLength)));
    const impact = Math.min(largestArrayChange * 2 + analysis.arrayChanges.length * 5, 50);
    totalScore += impact;
    factors.push({
      name: 'Array Mutations',
      description: `${analysis.arrayChanges.length} array(s) changed`,
      impact,
      details: analysis.arrayChanges.map(a =>
        `${a.path}: ${a.previousLength} → ${a.newLength} items`
      ).join(', '),
    });
  }

  // Factor 3: Large object changes
  if (analysis.largeObjectChanges.length > 0) {
    const totalSize = analysis.largeObjectChanges.reduce((sum, o) => sum + o.size, 0);
    const impact = Math.min(totalSize / 10000 * 20, 30); // 10KB = 20 impact
    totalScore += impact;
    factors.push({
      name: 'Large Object Changes',
      description: `${analysis.largeObjectChanges.length} large object(s) changed (${formatBytes(totalSize)})`,
      impact,
      details: 'Large objects can cause expensive diffing and template updates',
    });
  }

  // Factor 4: Deep changes
  if (analysis.maxChangeDepth > 3) {
    const impact = Math.min((analysis.maxChangeDepth - 3) * 5, 15);
    totalScore += impact;
    factors.push({
      name: 'Deep State Changes',
      description: `Changes at depth ${analysis.maxChangeDepth}`,
      impact,
      details: 'Deeply nested changes may indicate non-normalized state',
    });
  }

  // Factor 5: Total properties changed
  if (analysis.totalPropertiesChanged > 10) {
    const impact = Math.min(analysis.totalPropertiesChanged / 5, 20);
    totalScore += impact;
    factors.push({
      name: 'Property Change Volume',
      description: `${analysis.totalPropertiesChanged} total properties changed`,
      impact,
    });
  }

  // Cap the score at 100
  totalScore = Math.min(Math.round(totalScore), 100);

  // Determine level
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (totalScore < 25) level = 'low';
  else if (totalScore < 50) level = 'medium';
  else if (totalScore < 75) level = 'high';
  else level = 'critical';

  // Estimate affected components
  const estimatedComponentsAffected = Math.ceil(
    analysis.rootPropertiesChanged * 2 +
    analysis.arrayChanges.length * 3 +
    analysis.largeObjectChanges.length
  );

  // Generate recommendations
  const recommendations = generateRecommendations(analysis, factors, actionType);

  return {
    score: totalScore,
    level,
    estimatedComponentsAffected,
    factors,
    recommendations,
  };
}

/**
 * Analyze the differences between two states.
 */
function analyzeStateChange(prevState: any, nextState: any): StateChangeAnalysis {
  const analysis: StateChangeAnalysis = {
    rootPropertiesChanged: 0,
    totalPropertiesChanged: 0,
    arrayChanges: [],
    largeObjectChanges: [],
    maxChangeDepth: 0,
  };

  if (!prevState || !nextState) {
    return analysis;
  }

  // Analyze root level changes
  const allKeys = new Set([...Object.keys(prevState || {}), ...Object.keys(nextState || {})]);

  for (const key of allKeys) {
    if (prevState?.[key] !== nextState?.[key]) {
      analysis.rootPropertiesChanged++;
      analyzeDeep(prevState?.[key], nextState?.[key], key, 1, analysis);
    }
  }

  return analysis;
}

function analyzeDeep(
  prev: any,
  next: any,
  path: string,
  depth: number,
  analysis: StateChangeAnalysis
): void {
  analysis.maxChangeDepth = Math.max(analysis.maxChangeDepth, depth);
  analysis.totalPropertiesChanged++;

  // Check for array changes
  if (Array.isArray(prev) || Array.isArray(next)) {
    const prevArr = Array.isArray(prev) ? prev : [];
    const nextArr = Array.isArray(next) ? next : [];

    if (prevArr.length !== nextArr.length || prev !== next) {
      analysis.arrayChanges.push({
        path,
        previousLength: prevArr.length,
        newLength: nextArr.length,
        itemsAdded: Math.max(0, nextArr.length - prevArr.length),
        itemsRemoved: Math.max(0, prevArr.length - nextArr.length),
      });
    }
    return;
  }

  // Check for large object changes
  if (typeof next === 'object' && next !== null) {
    const size = estimateSize(next);
    if (size > 5000) { // 5KB threshold
      analysis.largeObjectChanges.push({
        path,
        size,
        changeType: prev === undefined ? 'added' : prev === null ? 'added' : 'modified',
      });
    }

    // Recurse into object (limit depth to prevent infinite loops)
    if (depth < 10) {
      const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
      for (const key of allKeys) {
        if (prev?.[key] !== next?.[key]) {
          analyzeDeep(prev?.[key], next?.[key], `${path}.${key}`, depth + 1, analysis);
        }
      }
    }
  }
}

function estimateSize(obj: any): number {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateRecommendations(
  analysis: StateChangeAnalysis,
  factors: RenderImpactFactor[],
  actionType: string
): string[] {
  const recommendations: string[] = [];

  // Array recommendations
  const largeArrayChanges = analysis.arrayChanges.filter(a => a.newLength > 100);
  if (largeArrayChanges.length > 0) {
    recommendations.push(
      'Consider using trackBy in *ngFor for large arrays to reduce DOM updates'
    );
    recommendations.push(
      'Use virtual scrolling (cdk-virtual-scroll-viewport) for lists with 100+ items'
    );
  }

  // Large object recommendations
  if (analysis.largeObjectChanges.length > 0) {
    recommendations.push(
      'Break down large state objects into smaller, normalized entities'
    );
    recommendations.push(
      'Use OnPush change detection strategy in components displaying this data'
    );
  }

  // Deep nesting recommendations
  if (analysis.maxChangeDepth > 4) {
    recommendations.push(
      'Normalize deeply nested state using @ngrx/entity for better performance'
    );
  }

  // Multiple root changes
  if (analysis.rootPropertiesChanged > 2) {
    recommendations.push(
      'Consider batching related state updates into a single action'
    );
  }

  // General high impact recommendations
  const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);
  if (totalImpact > 50) {
    recommendations.push(
      'Use memoized selectors to prevent unnecessary recomputations'
    );
    recommendations.push(
      'Consider using component-level state for frequently changing UI state'
    );
  }

  return recommendations;
}
