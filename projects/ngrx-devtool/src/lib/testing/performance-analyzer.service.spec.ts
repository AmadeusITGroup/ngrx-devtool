import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  PerformanceAnalyzerService,
  PerformanceReport,
} from '../performance/performance-analyzer.service';
import {
  PerformanceTrackerService,
  RenderPerformanceEntry,
  AggregatedPerformanceStats,
} from '../performance/performance-tracker.service';
import { PerformanceWarningType } from '../../types/state.model';

describe('PerformanceAnalyzerService', () => {
  let analyzer: PerformanceAnalyzerService;
  let tracker: PerformanceTrackerService;

  function injectEntries(entries: RenderPerformanceEntry[]): void {
    (tracker as unknown as { entries: RenderPerformanceEntry[] }).entries = entries;
    if (entries.length > 0) {
      (tracker as unknown as { firstActionTime: number }).firstActionTime = entries[0].timestamp;
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PerformanceTrackerService,
        PerformanceAnalyzerService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    tracker = TestBed.inject(PerformanceTrackerService);
    analyzer = TestBed.inject(PerformanceAnalyzerService);
  });

  afterEach(() => {
    tracker.clear();
  });

  describe('generateReport()', () => {
    it('should produce a valid report structure', () => {
      const report = analyzer.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('scoreGrade');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('hotspots');
      expect(report).toHaveProperty('trends');
    });

    it('should return ISO timestamp', () => {
      const report = analyzer.generateReport();

      expect(() => new Date(report.timestamp)).not.toThrow();
      expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should give grade A for fast actions', () => {
      injectEntries([
        { actionType: 'fast', timestamp: Date.now(), renderTime: 2 },
        { actionType: 'fast', timestamp: Date.now(), renderTime: 3 },
      ]);

      const report = analyzer.generateReport();

      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.scoreGrade).toBe('A');
    });

    it('should give lower grade for slow actions', () => {
      injectEntries([
        { actionType: 'slow', timestamp: Date.now(), renderTime: 80 },
        { actionType: 'slow', timestamp: Date.now(), renderTime: 90 },
      ]);

      const report = analyzer.generateReport();

      expect(report.overallScore).toBeLessThan(90);
      expect(['B', 'C', 'D', 'F']).toContain(report.scoreGrade);
    });
  });

  describe('score grading', () => {
    it('should map scores to correct letter grades', () => {
      const getGrade = (score: number) =>
        (analyzer as unknown as { getScoreGrade: (s: number) => string }).getScoreGrade(score);

      expect(getGrade(95)).toBe('A');
      expect(getGrade(90)).toBe('A');
      expect(getGrade(85)).toBe('B');
      expect(getGrade(80)).toBe('B');
      expect(getGrade(75)).toBe('C');
      expect(getGrade(70)).toBe('C');
      expect(getGrade(65)).toBe('D');
      expect(getGrade(60)).toBe('D');
      expect(getGrade(59)).toBe('F');
      expect(getGrade(0)).toBe('F');
    });
  });

  describe('getQuickSummary()', () => {
    it('should return summary with no main issue when no warnings exist', () => {
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 5 },
      ]);

      const summary = analyzer.getQuickSummary();

      expect(summary.mainIssue).toBeNull();
      expect(summary.actionCount).toBe(1);
      expect(summary.score).toBeGreaterThan(0);
    });

    it('should surface high-severity warning as main issue', () => {
      (tracker as unknown as { warnings: unknown[] }).warnings = [
        { type: PerformanceWarningType.SLOW_REDUCER, message: 'slow', severity: 'high' },
      ];

      const summary = analyzer.getQuickSummary();

      expect(summary.mainIssue).toBe('Slow reducer execution');
    });

    it('should not flag medium-severity warnings as main issue', () => {
      (tracker as unknown as { warnings: unknown[] }).warnings = [
        { type: PerformanceWarningType.LARGE_STATE, message: 'big', severity: 'medium' },
      ];

      const summary = analyzer.getQuickSummary();

      expect(summary.mainIssue).toBeNull();
    });
  });

  describe('analyzeActionType()', () => {
    it('should return empty result for non-existent action', () => {
      const result = analyzer.analyzeActionType('nonExistent');

      expect(result.stats).toBeUndefined();
      expect(result.isProblematic).toBe(false);
      expect(result.issues).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should flag slow actions exceeding threshold', () => {
      // Default maxReducerTime is 16ms
      injectEntries([
        { actionType: 'slowAction', timestamp: Date.now(), renderTime: 30 },
        { actionType: 'slowAction', timestamp: Date.now(), renderTime: 40 },
      ]);

      const result = analyzer.analyzeActionType('slowAction');

      expect(result.isProblematic).toBe(true);
      expect(result.issues.some(i => i.includes('exceeds threshold'))).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should flag high-frequency actions taking more than 30% of total', () => {
      const entries: RenderPerformanceEntry[] = [];
      // 20 of one type, 5 of another => 80% of all actions
      for (let i = 0; i < 20; i++) {
        entries.push({ actionType: 'frequent', timestamp: Date.now() + i, renderTime: 5 });
      }
      for (let i = 0; i < 5; i++) {
        entries.push({ actionType: 'other', timestamp: Date.now() + 20 + i, renderTime: 5 });
      }
      injectEntries(entries);

      const result = analyzer.analyzeActionType('frequent');

      expect(result.isProblematic).toBe(true);
      expect(result.issues.some(i => i.includes('%'))).toBe(true);
    });

    it('should flag performance spikes (max >> avg)', () => {
      // avgTime ~10ms, maxTime 100ms. Condition: maxTime > avgTime * 3 AND maxTime > threshold(16)
      injectEntries([
        { actionType: 'spikey', timestamp: Date.now(), renderTime: 5 },
        { actionType: 'spikey', timestamp: Date.now(), renderTime: 5 },
        { actionType: 'spikey', timestamp: Date.now(), renderTime: 5 },
        { actionType: 'spikey', timestamp: Date.now(), renderTime: 5 },
        { actionType: 'spikey', timestamp: Date.now(), renderTime: 100 },
      ]);

      const result = analyzer.analyzeActionType('spikey');

      expect(result.issues.some(i => i.includes('spikes'))).toBe(true);
    });

    it('should NOT flag fast, low-frequency action', () => {
      injectEntries([
        { actionType: 'nice', timestamp: Date.now(), renderTime: 2 },
        { actionType: 'other1', timestamp: Date.now(), renderTime: 2 },
        { actionType: 'other2', timestamp: Date.now(), renderTime: 2 },
      ]);

      const result = analyzer.analyzeActionType('nice');

      expect(result.isProblematic).toBe(false);
    });
  });

  describe('generateRecommendations()', () => {
    it('should recommend optimization when avg reducer time exceeds threshold', () => {
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 30 },
        { actionType: 'A', timestamp: Date.now(), renderTime: 40 },
      ]);

      const report = analyzer.generateReport();

      expect(report.recommendations.some(r => r.category === 'reducer')).toBe(true);
    });

    it('should recommend optimizing slowest action when max time is extreme', () => {
      // maxReducerTime > threshold * 2
      injectEntries([
        { actionType: 'bottleneck', timestamp: Date.now(), renderTime: 100 },
        { actionType: 'fast', timestamp: Date.now(), renderTime: 2 },
      ]);

      const report = analyzer.generateReport();

      const bottleneckRec = report.recommendations.find(
        r => r.title.includes('bottleneck')
      );
      expect(bottleneckRec).toBeDefined();
      expect(bottleneckRec!.impact).toBe('high');
    });

    it('should congratulate when performance is good and no issues', () => {
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 2 },
        { actionType: 'B', timestamp: Date.now(), renderTime: 3 },
      ]);

      const report = analyzer.generateReport();

      expect(report.recommendations.some(r => r.category === 'general')).toBe(true);
    });
  });

  describe('identifyHotspots()', () => {
    it('should identify slow actions as hotspots', () => {
      injectEntries([
        { actionType: 'slow', timestamp: Date.now(), renderTime: 30 },
        { actionType: 'slow', timestamp: Date.now(), renderTime: 40 },
        { actionType: 'fast', timestamp: Date.now(), renderTime: 2 },
      ]);

      const report = analyzer.generateReport();

      expect(report.hotspots.length).toBeGreaterThan(0);
      expect(report.hotspots[0].actionType).toBe('slow');
    });

    it('should limit hotspots to 5', () => {
      const entries: RenderPerformanceEntry[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push({
          actionType: `slow_${i}`,
          timestamp: Date.now() + i,
          renderTime: 30 + i,
        });
      }
      injectEntries(entries);

      const report = analyzer.generateReport();

      expect(report.hotspots.length).toBeLessThanOrEqual(5);
    });

    it('should sort hotspots by total time descending', () => {
      injectEntries([
        { actionType: 'medium', timestamp: Date.now(), renderTime: 25 },
        { actionType: 'medium', timestamp: Date.now(), renderTime: 25 },
        { actionType: 'slow', timestamp: Date.now(), renderTime: 30 },
        { actionType: 'slow', timestamp: Date.now(), renderTime: 40 },
        { actionType: 'slow', timestamp: Date.now(), renderTime: 35 },
      ]);

      const report = analyzer.generateReport();
      const hotspotNames = report.hotspots.map(h => h.actionType);

      if (hotspotNames.length >= 2) {
        expect(report.hotspots[0].totalTime).toBeGreaterThanOrEqual(
          report.hotspots[1].totalTime
        );
      }
    });
  });

  describe('analyzeTrends()', () => {
    it('should return "stable" for all trends on first report', () => {
      const report = analyzer.generateReport();

      expect(report.trends.reducerTimesTrend).toBe('stable');
      expect(report.trends.stateSizeTrend).toBe('stable');
      expect(report.trends.actionFrequencyTrend).toBe('stable');
    });

    it('should detect degrading reducer times between reports', () => {
      // First report with fast actions
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 5 },
      ]);
      analyzer.generateReport();

      // Second report with slow actions
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 5 },
        { actionType: 'B', timestamp: Date.now(), renderTime: 50 },
      ]);
      const report2 = analyzer.generateReport();

      expect(report2.trends.reducerTimesTrend).toBe('degrading');
    });

    it('should detect improving reducer times between reports', () => {
      // First report: slow
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 50 },
      ]);
      analyzer.generateReport();

      // Second report: fast
      injectEntries([
        { actionType: 'A', timestamp: Date.now(), renderTime: 3 },
      ]);
      const report2 = analyzer.generateReport();

      expect(report2.trends.reducerTimesTrend).toBe('improving');
    });
  });

  describe('formatBytes()', () => {
    it('should format various byte sizes correctly', () => {
      const formatBytes = (bytes: number) =>
        (analyzer as unknown as { formatBytes: (b: number) => string }).formatBytes(bytes);

      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toContain('B');
      expect(formatBytes(1024)).toContain('KB');
      expect(formatBytes(1048576)).toContain('MB');
    });
  });
});
