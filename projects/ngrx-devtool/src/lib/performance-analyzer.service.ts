import { inject, Injectable } from '@angular/core';
import {
  PerformanceTrackerService,
  AggregatedPerformanceStats,
  ActionTypeStats
} from './performance-tracker.service';
import { PerformanceWarningType } from '../types/state.model';

export interface PerformanceRecommendation {
  readonly category: 'reducer' | 'state' | 'actions' | 'memory' | 'general';
  readonly title: string;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly codeExample?: string;
  readonly learnMoreUrl?: string;
}

export interface PerformanceReport {
  readonly timestamp: string;
  readonly overallScore: number;
  readonly scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly stats: AggregatedPerformanceStats;
  readonly recommendations: readonly PerformanceRecommendation[];
  readonly hotspots: readonly HotspotInfo[];
  readonly trends: PerformanceTrends;
}

export interface HotspotInfo {
  readonly actionType: string;
  readonly issue: string;
  readonly avgTime: number;
  readonly callCount: number;
  readonly totalTime: number;
  readonly percentOfTotal: number;
}

export interface PerformanceTrends {
  readonly reducerTimesTrend: 'improving' | 'stable' | 'degrading';
  readonly stateSizeTrend: 'stable' | 'growing' | 'shrinking';
  readonly actionFrequencyTrend: 'stable' | 'increasing' | 'decreasing';
}

@Injectable({ providedIn: 'root' })
export class PerformanceAnalyzerService {
  private previousStats: AggregatedPerformanceStats | null = null;
  private readonly performanceTracker = inject(PerformanceTrackerService);

  generateReport(): PerformanceReport {
    const stats = this.performanceTracker.getAggregatedStats();
    const recommendations = this.generateRecommendations(stats);
    const hotspots = this.identifyHotspots(stats);
    const trends = this.analyzeTrends(stats);

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      overallScore: stats.performanceScore,
      scoreGrade: this.getScoreGrade(stats.performanceScore),
      stats,
      recommendations,
      hotspots,
      trends,
    };

    this.previousStats = stats;

    return report;
  }

  getQuickSummary(): {
    score: number;
    grade: string;
    mainIssue: string | null;
    actionCount: number;
    avgReducerTime: number;
  } {
    const stats = this.performanceTracker.getAggregatedStats();
    const warnings = this.performanceTracker.getWarningsSummary();

    let mainIssue: string | null = null;
    const highSeverityWarning = warnings.find(w => w.severity === 'high');
    if (highSeverityWarning) {
      mainIssue = this.getWarningDescription(highSeverityWarning.type);
    }

    return {
      score: stats.performanceScore,
      grade: this.getScoreGrade(stats.performanceScore),
      mainIssue,
      actionCount: stats.totalActions,
      avgReducerTime: stats.avgReducerTime,
    };
  }

  analyzeActionType(actionType: string): {
    stats: ActionTypeStats | undefined;
    isProblematic: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const stats = this.performanceTracker.getAggregatedStats();
    const actionStats = stats.actionTypeStats.get(actionType);
    const thresholds = this.performanceTracker.getThresholds();

    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!actionStats) {
      return { stats: undefined, isProblematic: false, issues, suggestions };
    }

    if (actionStats.avgTime > thresholds.maxReducerTime) {
      issues.push(`Average execution time (${actionStats.avgTime.toFixed(2)}ms) exceeds threshold`);
      suggestions.push('Consider optimizing the reducer logic for this action');
    }

    const totalActions = stats.totalActions;
    const percentOfTotal = (actionStats.count / totalActions) * 100;
    if (percentOfTotal > 30 && actionStats.count > 10) {
      issues.push(`This action represents ${percentOfTotal.toFixed(1)}% of all actions`);
      suggestions.push('Consider debouncing or batching this action if dispatched frequently');
    }

    if (actionStats.maxTime > actionStats.avgTime * 3 && actionStats.maxTime > thresholds.maxReducerTime) {
      issues.push(`Occasional spikes in execution time (max: ${actionStats.maxTime.toFixed(2)}ms)`);
      suggestions.push('Investigate what causes performance spikes - possibly large payload or complex state updates');
    }

    return {
      stats: actionStats,
      isProblematic: issues.length > 0,
      issues,
      suggestions,
    };
  }

  private generateRecommendations(stats: AggregatedPerformanceStats): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];
    const thresholds = this.performanceTracker.getThresholds();
    const warnings = this.performanceTracker.getWarningsSummary();

    if (stats.avgReducerTime > thresholds.maxReducerTime) {
      recommendations.push({
        category: 'reducer',
        title: 'Optimize Reducer Performance',
        description: `Your reducers are taking an average of ${stats.avgReducerTime.toFixed(2)}ms to execute. For smooth 60fps animations, reducers should complete in under ${thresholds.maxReducerTime}ms.`,
        impact: stats.avgReducerTime > thresholds.maxReducerTime * 2 ? 'high' : 'medium',
        codeExample: `import { createReducer, on } from '@ngrx/store';
import { produce } from 'immer';

on(someAction, (state, { items }) => ({
  ...state,
  items
}))`,
        learnMoreUrl: 'https://ngrx.io/guide/store/reducers#reducer-functions',
      });
    }

    if (stats.currentStateSize > thresholds.maxStateSize * 0.5) {
      recommendations.push({
        category: 'state',
        title: 'Consider State Normalization',
        description: `Your state size is ${this.formatBytes(stats.currentStateSize)}. Large states can slow down serialization and increase memory usage.`,
        impact: stats.currentStateSize > thresholds.maxStateSize ? 'high' : 'medium',
        codeExample: `{ users: [{ id: 1, posts: [{ id: 1, ... }] }] }

{
  users: { ids: [1], entities: { 1: { id: 1 } } },
  posts: { ids: [1], entities: { 1: { id: 1, userId: 1 } } }
}`,
        learnMoreUrl: 'https://ngrx.io/guide/entity',
      });
    }

    if (stats.actionsPerSecond > thresholds.maxActionsPerSecond * 0.5) {
      recommendations.push({
        category: 'actions',
        title: 'Reduce Action Dispatch Frequency',
        description: `You're dispatching ${stats.actionsPerSecond.toFixed(1)} actions per second. High frequency can cause performance issues.`,
        impact: stats.actionsPerSecond > thresholds.maxActionsPerSecond ? 'high' : 'medium',
        codeExample: `import { debounceTime } from 'rxjs/operators';

searchInput$.pipe(
  debounceTime(300)
).subscribe(term => {
  this.store.dispatch(searchAction({ term }));
});

this.store.dispatch(batchUpdateAction({ items: allItems }));`,
      });
    }

    if (stats.slowestAction && stats.maxReducerTime > thresholds.maxReducerTime * 2) {
      recommendations.push({
        category: 'reducer',
        title: `Optimize "${stats.slowestAction}"`,
        description: `This action has the highest execution time (${stats.maxReducerTime.toFixed(2)}ms). Focus optimization efforts here for maximum impact. Profile this specific action to identify bottlenecks.`,
        impact: 'high',
      });
    }

    const memoryWarnings = warnings.filter(w => w.type === PerformanceWarningType.MEMORY_PRESSURE);
    if (memoryWarnings.length > 0) {
      recommendations.push({
        category: 'memory',
        title: 'Address Memory Pressure',
        description: 'Your application is using a significant portion of available memory. This can lead to garbage collection pauses.',
        impact: 'high',
        codeExample: `ngOnDestroy() {
  this.store.dispatch(clearTemporaryData());
}

this.store.dispatch(loadPage({ page: 1, pageSize: 50 }));`,
      });
    }

    if (stats.performanceScore >= 80 && recommendations.length === 0) {
      recommendations.push({
        category: 'general',
        title: 'Performance is Good! 🎉',
        description: 'Your NgRx store is performing well. Continue following best practices.',
        impact: 'low',
      });
    }

    return recommendations;
  }

  private identifyHotspots(stats: AggregatedPerformanceStats): HotspotInfo[] {
    const hotspots: HotspotInfo[] = [];
    const totalTime = Array.from(stats.actionTypeStats.values())
      .reduce((sum, s) => sum + s.totalTime, 0);

    stats.actionTypeStats.forEach((actionStats, actionType) => {
      const percentOfTotal = (actionStats.totalTime / totalTime) * 100;
      const thresholds = this.performanceTracker.getThresholds();

      let issue = '';
      if (actionStats.avgTime > thresholds.maxReducerTime) {
        issue = 'Slow reducer execution';
      } else if (percentOfTotal > 20 && actionStats.count > 5) {
        issue = 'High time consumption';
      } else if (actionStats.maxTime > actionStats.avgTime * 5) {
        issue = 'Inconsistent performance';
      }

      if (issue) {
        hotspots.push({
          actionType,
          issue,
          avgTime: actionStats.avgTime,
          callCount: actionStats.count,
          totalTime: actionStats.totalTime,
          percentOfTotal,
        });
      }
    });

    return hotspots.sort((a, b) => b.totalTime - a.totalTime).slice(0, 5);
  }

  private analyzeTrends(currentStats: AggregatedPerformanceStats): PerformanceTrends {
    if (!this.previousStats) {
      return {
        reducerTimesTrend: 'stable',
        stateSizeTrend: 'stable',
        actionFrequencyTrend: 'stable',
      };
    }

    const prev = this.previousStats;

    let reducerTimesTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    const timeDiff = currentStats.avgReducerTime - prev.avgReducerTime;
    if (timeDiff > 2) reducerTimesTrend = 'degrading';
    else if (timeDiff < -2) reducerTimesTrend = 'improving';

    let stateSizeTrend: 'stable' | 'growing' | 'shrinking' = 'stable';
    const sizeDiff = currentStats.currentStateSize - prev.currentStateSize;
    const sizeChangePercent = Math.abs(sizeDiff) / (prev.currentStateSize || 1) * 100;
    if (sizeChangePercent > 10) {
      stateSizeTrend = sizeDiff > 0 ? 'growing' : 'shrinking';
    }

    let actionFrequencyTrend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    const freqDiff = currentStats.actionsPerSecond - prev.actionsPerSecond;
    if (freqDiff > 5) actionFrequencyTrend = 'increasing';
    else if (freqDiff < -5) actionFrequencyTrend = 'decreasing';

    return {
      reducerTimesTrend,
      stateSizeTrend,
      actionFrequencyTrend,
    };
  }

  private getScoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private getWarningDescription(type: string): string {
    const descriptions: Record<string, string> = {
      SLOW_REDUCER: 'Slow reducer execution',
      LARGE_STATE: 'Large state size',
      LARGE_STATE_CHANGE: 'Large state changes',
      FREQUENT_ACTIONS: 'High action frequency',
      LARGE_PAYLOAD: 'Large action payloads',
      MEMORY_PRESSURE: 'Memory pressure',
    };
    return descriptions[type] || type;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}
