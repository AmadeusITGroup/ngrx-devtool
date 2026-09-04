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
      renderPerformance: { renderTime: 10, reducerTime: 2, stateSize: 1024 },
    },
    {
      type: 'STATE_CHANGE',
      action: { type: '[Books] Add Book' },
      renderPerformance: { renderTime: 25, reducerTime: 4, stateSize: 2048 },
    },
    {
      type: 'STATE_CHANGE',
      action: { type: '[Books] Remove Book' },
      renderPerformance: { renderTime: 50, reducerTime: 6, stateSize: 4096 },
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
      const processMessagesSpy = jest.spyOn(component as unknown as { processMessages: () => void }, 'processMessages');

      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });

      expect(processMessagesSpy).toHaveBeenCalled();
    });

    it('should scroll to action when selectedActionType changes', () => {
      const scrollToActionSpy = jest.spyOn(component as unknown as { scrollToAction: (action: string) => void }, 'scrollToAction');

      component.selectedActionType = '[Books] Load Success';
      component.ngOnChanges({
        selectedActionType: new SimpleChange(null, '[Books] Load Success', false),
      });

      expect(scrollToActionSpy).toHaveBeenCalledWith('[Books] Load Success');
    });

    it('should not scroll when selectedActionType is null', () => {
      const scrollToActionSpy = jest.spyOn(component as unknown as { scrollToAction: (action: string) => void }, 'scrollToAction');

      component.selectedActionType = null;
      component.ngOnChanges({
        selectedActionType: new SimpleChange('[Books] Load Success', null, false),
      });

      expect(scrollToActionSpy).not.toHaveBeenCalled();
    });
  });

  describe('actionEntries', () => {
    it('should return entries sorted by render time descending', () => {
      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });

      const slowest = component.actionEntries();

      expect(slowest[0].renderTime).toBe(50);
      expect(slowest[1].renderTime).toBe(25);
      expect(slowest[2].renderTime).toBe(10);
    });

    it('should include every measured action', () => {
      const manyMessages = Array.from({ length: 15 }, (_, i) => ({
        type: 'STATE_CHANGE',
        action: { type: `[Action ${i}]` },
        renderPerformance: { renderTime: i * 10 },
      }));

      component.messages = manyMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, manyMessages, true),
      });

      expect(component.actionEntries()).toHaveLength(15);
    });
  });

  describe('formatMs', () => {
    it('should format milliseconds with 2 decimal places', () => {
      expect(component.formatMs(10)).toBe('10.00 ms');
      expect(component.formatMs(10.123)).toBe('10.12 ms');
      expect(component.formatMs(0.5)).toBe('0.50 ms');
    });
  });

  describe('formatBytes', () => {
    it('should format state size with suitable units', () => {
      expect(component.formatBytes(0)).toBe('0 B');
      expect(component.formatBytes(500)).toBe('500 B');
      expect(component.formatBytes(2048)).toBe('2.00 KB');
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

  describe('message filtering', () => {
    it('should only process STATE_CHANGE messages with renderPerformance', () => {
      const mixedMessages = [
        {
          type: 'STATE_CHANGE',
          action: { type: '[Valid]' },
          renderPerformance: { renderTime: 10 },
        },
        {
          type: 'OTHER',
          action: { type: '[Invalid Type]' },
          renderPerformance: { renderTime: 20 },
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

      expect(component.actionEntries()).toHaveLength(1);
    });
  });

  describe('template', () => {
    it('should show only per-action measurements', () => {
      component.messages = mockMessages;
      component.ngOnChanges({
        messages: new SimpleChange(null, mockMessages, true),
      });
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;

      expect(text).toContain('Action Performance');
      expect(text).toContain('Reducer Time');
      expect(text).toContain('Render Time');
      expect(text).toContain('State Size');
      expect(fixture.nativeElement.querySelector('.mat-column-status').textContent).toContain('Status');
      expect(text).not.toContain('Avg');
      expect(text).not.toContain('Store and Render Performance');
      expect(fixture.nativeElement.querySelectorAll('.mat-mdc-row')).toHaveLength(3);
    });

    it('should show unavailable optional measurements as N/A', () => {
      component.messages = [{
        type: 'STATE_CHANGE',
        action: { type: '[Legacy] Action' },
        renderPerformance: { renderTime: 10 },
      }];
      component.ngOnChanges({
        messages: new SimpleChange(null, component.messages, true),
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent.match(/N\/A/g)).toHaveLength(2);
    });
  });
});
