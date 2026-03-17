export interface EffectEventMessage {
  readonly type: 'EFFECT_EVENT';
  readonly action?: string;
  readonly effectName?: string;
  readonly effectEvent?: {
    readonly name: string;
    readonly lifecycle: 'triggered' | 'emitted' | 'executed' | 'error';
    readonly duration?: number;
    readonly executionId?: string;
    readonly dispatch?: boolean;
    readonly errorMessage?: string;
    readonly errorStack?: string;
  };
  readonly timestamp: string;
}

export interface EffectExecution {
  readonly effectName: string;
  readonly sourceName: string;
  readonly propertyName: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly status: 'completed' | 'executed' | 'error';
  readonly triggeredAction?: string;
  readonly emittedAction?: string;
  readonly executionId?: string;
  readonly dispatch?: boolean;
  readonly errorMessage?: string;
  readonly errorStack?: string;
}
