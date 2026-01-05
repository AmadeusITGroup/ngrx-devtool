export interface RenderImpactEstimate {
  readonly score: number;
  readonly level: 'low' | 'medium' | 'high' | 'critical';
  readonly estimatedComponentsAffected: number;
  readonly factors: readonly RenderImpactFactor[];
  readonly recommendations: readonly string[];
}

export interface RenderImpactFactor {
  readonly name: string;
  readonly description: string;
  readonly impact: number;
  readonly details?: string;
}

export interface StateChangeAnalysis {
  rootPropertiesChanged: number;
  totalPropertiesChanged: number;
  arrayChanges: ArrayChangeInfo[];
  largeObjectChanges: LargeObjectChange[];
  maxChangeDepth: number;
}

export interface ArrayChangeInfo {
  readonly path: string;
  readonly previousLength: number;
  readonly newLength: number;
  readonly itemsAdded: number;
  readonly itemsRemoved: number;
}

export interface LargeObjectChange {
  readonly path: string;
  readonly size: number;
  readonly changeType: 'added' | 'modified' | 'replaced';
}

export function estimateRenderImpact(
  prevState: unknown,
  nextState: unknown,
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

function analyzeStateChange(prevState: unknown, nextState: unknown): StateChangeAnalysis {
  const analysis: StateChangeAnalysis = {
    rootPropertiesChanged: 0,
    totalPropertiesChanged: 0,
    arrayChanges: [],
    largeObjectChanges: [],
    maxChangeDepth: 0,
  };

  if (!prevState || !nextState || typeof prevState !== 'object' || typeof nextState !== 'object') {
    return analysis;
  }

  const prevObj = prevState as Record<string, unknown>;
  const nextObj = nextState as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

  for (const key of allKeys) {
    if (prevObj[key] !== nextObj[key]) {
      analysis.rootPropertiesChanged++;
      analyzeDeep(prevObj[key], nextObj[key], key, 1, analysis);
    }
  }

  return analysis;
}

function analyzeDeep(
  prev: unknown,
  next: unknown,
  path: string,
  depth: number,
  analysis: StateChangeAnalysis
): void {
  analysis.maxChangeDepth = Math.max(analysis.maxChangeDepth, depth);
  analysis.totalPropertiesChanged++;

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

  if (typeof next === 'object' && next !== null) {
    const size = estimateSize(next);
    if (size > 5000) {
      analysis.largeObjectChanges.push({
        path,
        size,
        changeType: prev === undefined || prev === null ? 'added' : 'modified',
      });
    }

    if (depth < 10) {
      const prevObj = (prev && typeof prev === 'object' ? prev : {}) as Record<string, unknown>;
      const nextObj = next as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

      for (const key of allKeys) {
        if (prevObj[key] !== nextObj[key]) {
          analyzeDeep(prevObj[key], nextObj[key], `${path}.${key}`, depth + 1, analysis);
        }
      }
    }
  }
}

function estimateSize(obj: unknown): number {
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
  factors: readonly RenderImpactFactor[],
  _actionType: string
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
