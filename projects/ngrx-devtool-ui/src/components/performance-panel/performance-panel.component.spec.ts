import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { PerformancePanelComponent } from './performance-panel.component';

describe('PerformancePanelComponent', () => {
  let component: PerformancePanelComponent;
  let fixture: ComponentFixture<PerformancePanelComponent>;

  const mockMessages = [
    {
      type: 'STATE_CHANGE',
      action: { type: '[Books] Load Success' },
      renderPerformance: { totalRenderTime: 10 },
    },
    {
      type: 'STATE_CHANGE',
      action: { type: '[Books] Add Book' },
      renderPerformance: { totalRenderTime: 25 },
    },
    {
      type: 'STATE_CHANGE',
      action: { type: '[Books] Remove Book' },
      renderPerformance: { totalRenderTime: 50 },
    },
    {
      type: 'OTHER_TYPE',
      action: { type: '[Books] Other' },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerformancePanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformancePanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnChanges', () => {
    it('should process messages when messages input changes', () => {
      const processMessagesSpy = jest.spyOn(component as any, 'processMessages');

      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });

      expect(processMessagesSpy).toHaveBeenCalled();
    });

    it('should scroll to action when selectedActionType changes', () => {
      const scrollToActionSpy = jest.spyOn(component as any, 'scrollToAction');

      component.selectedActionType = '[Books] Load Success';
      component.ngOnChanges({
        selectedActionType: new SimpleChange(null, '[Books] Load Success', false),
      });

      expect(scrollToActionSpy).toHaveBeenCalledWith('[Books] Load Success');
    });

    it('should not scroll when selectedActionType is null', () => {
      const scrollToActionSpy = jest.spyOn(component as any, 'scrollToAction');

      component.selectedActionType = null;
      component.ngOnChanges({
        selectedActionType: new SimpleChange('[Books] Load Success', null, false),
      });

      expect(scrollToActionSpy).not.toHaveBeenCalled();
    });
  });

  describe('renderStats', () => {
    it('should return zero stats when no entries', () => {
      const stats = component.renderStats();

      expect(stats).toEqual({
        avgRenderTime: 0,
        maxRenderTime: 0,
        totalActions: 0,
      });
    });

    it('should calculate correct stats from messages', () => {
      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });

      const stats = component.renderStats();

      expect(stats.totalActions).toBe(3);
      expect(stats.maxRenderTime).toBe(50);
      expect(stats.avgRenderTime).toBeCloseTo(28.33, 1);
    });
  });

  describe('slowestRenders', () => {
    it('should return entries sorted by render time descending', () => {
      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });

      const slowest = component.slowestRenders();

      expect(slowest[0].totalRenderTime).toBe(50);
      expect(slowest[1].totalRenderTime).toBe(25);
      expect(slowest[2].totalRenderTime).toBe(10);
    });

    it('should limit to 10 entries', () => {
      const manyMessages = Array.from({ length: 15 }, (_, i) => ({
        type: 'STATE_CHANGE',
        action: { type: `[Action ${i}]` },
        renderPerformance: { totalRenderTime: i * 10 },
      }));

      component.messages = manyMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, manyMessages, true),
      });

      expect(component.slowestRenders().length).toBe(10);
    });
  });

  describe('formatMs', () => {
    it('should format milliseconds with 2 decimal places', () => {
      expect(component.formatMs(10)).toBe('10.00ms');
      expect(component.formatMs(10.123)).toBe('10.12ms');
      expect(component.formatMs(0.5)).toBe('0.50ms');
    });
  });

  describe('getRenderStatus', () => {
    it('should return "good" for render time <= 16ms', () => {
      expect(component.getRenderStatus(10)).toBe('good');
      expect(component.getRenderStatus(16)).toBe('good');
    });

    it('should return "warning" for render time between 16ms and 32ms', () => {
      expect(component.getRenderStatus(17)).toBe('warning');
      expect(component.getRenderStatus(32)).toBe('warning');
    });

    it('should return "critical" for render time > 32ms', () => {
      expect(component.getRenderStatus(33)).toBe('critical');
      expect(component.getRenderStatus(100)).toBe('critical');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(component.getStatusColor('good')).toBe('#4caf50');
      expect(component.getStatusColor('warning')).toBe('#ff9800');
      expect(component.getStatusColor('critical')).toBe('#f44336');
    });
  });

  describe('hasPerformanceIssues', () => {
    it('should return false when no entries', () => {
      expect(component.hasPerformanceIssues()).toBe(false);
    });

    it('should return false when max render time is within budget', () => {
      component.messages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Test]' },
          renderPerformance: { totalRenderTime: 10 },
        },
      ];
      component.ngOnChanges({
        messages: new SimpleChange(null, component.messages, true),
      });

      expect(component.hasPerformanceIssues()).toBe(false);
    });

    it('should return true when max render time exceeds budget', () => {
      component.messages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Test]' },
          renderPerformance: { totalRenderTime: 50 },
        },
      ];
      component.ngOnChanges({
        messages: new SimpleChange(null, component.messages, true),
      });

      expect(component.hasPerformanceIssues()).toBe(true);
    });
  });

  describe('getOptimizationTips', () => {
    it('should return "Performance looks good!" when no issues', () => {
      const tips = component.getOptimizationTips();

      expect(tips).toEqual([{ text: 'Performance looks good!' }]);
    });

    it('should return OnPush tip when render time > 32ms', () => {
      component.messages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Test]' },
          renderPerformance: { totalRenderTime: 40 },
        },
      ];
      component.ngOnChanges({
        messages: new SimpleChange(null, component.messages, true),
      });

      const tips = component.getOptimizationTips();

      expect(tips.some(tip => tip.text.includes('OnPush'))).toBe(true);
    });

    it('should return multiple tips for very slow renders', () => {
      component.messages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Test]' },
          renderPerformance: { totalRenderTime: 200 },
        },
      ];
      component.ngOnChanges({
        messages: new SimpleChange(null, component.messages, true),
      });

      const tips = component.getOptimizationTips();

      expect(tips.length).toBeGreaterThan(1);
      expect(tips.some(tip => tip.text.includes('OnPush'))).toBe(true);
      expect(tips.some(tip => tip.text.includes('trackBy'))).toBe(true);
      expect(tips.some(tip => tip.text.includes('virtual scrolling'))).toBe(true);
      expect(tips.some(tip => tip.text.includes('@defer'))).toBe(true);
      expect(tips.some(tip => tip.text.includes('signals'))).toBe(true);
    });
  });

  describe('isSelectedAction', () => {
    it('should return true when action matches selectedActionType', () => {
      component.selectedActionType = '[Books] Load Success';

      expect(component.isSelectedAction('[Books] Load Success')).toBe(true);
    });

    it('should return false when action does not match', () => {
      component.selectedActionType = '[Books] Load Success';

      expect(component.isSelectedAction('[Books] Add Book')).toBe(false);
    });

    it('should return false when selectedActionType is null', () => {
      component.selectedActionType = null;

      expect(component.isSelectedAction('[Books] Load Success')).toBe(false);
    });
  });

  describe('openAngularProfiler', () => {
    it('should open Angular DevTools documentation', () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      component.openAngularProfiler();

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://angular.dev/tools/devtools',
        '_blank'
      );

      windowOpenSpy.mockRestore();
    });
  });

  describe('message filtering', () => {
    it('should only process STATE_CHANGE messages with renderPerformance', () => {
      const mixedMessages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Valid]' },
          renderPerformance: { totalRenderTime: 10 },
        },
        {
          type: 'OTHER',
          action: { type: '[Invalid Type]' },
          renderPerformance: { totalRenderTime: 20 },
        },
        {
          type: 'STATE_CHANGE',
          action: { type: '[No Perf]' },
        },
      ];

      component.messages = mixedMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mixedMessages, true),
      });

      expect(component.renderStats().totalActions).toBe(1);
    });
  });
});
