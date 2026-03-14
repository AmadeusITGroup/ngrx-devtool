import { Action } from '@ngrx/store';

export const DEFAULT_WS_URL = 'ws://localhost:4000';

export type EffectLifecycle = 'triggered' | 'emitted' | 'executed' | 'error';

export interface EffectEvent {
  readonly effectName: string;
  readonly sourceName: string;
  readonly propertyName: string;
  readonly lifecycle: EffectLifecycle;
  readonly timestamp: number;
  readonly triggerAction?: Action;
  readonly action?: Action;
  readonly error?: unknown;
  readonly duration?: number;
  readonly executionId?: string;
  readonly dispatch?: boolean;
}

export interface EffectMetadataInfo {
  readonly propertyName: string;
  readonly dispatch: boolean;
  readonly functional: boolean;
  readonly useEffectsErrorHandler: boolean;
}



export type ActionSource = 'user' | 'effect';

export type EffectStatus = 'completed' | 'error';

// Action tracked in the timeline
export interface TrackedAction {
  readonly action: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly source: ActionSource;
  readonly correlationId?: string;
  readonly effectName?: string;
}

// Effect execution
export interface TrackedEffect {
  readonly effectName: string;
  readonly sourceName: string | null;
  readonly propertyName: string;
  readonly triggerAction?: string;
  readonly resultAction?: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly status: EffectStatus;
  readonly error?: unknown;
}



export type DevToolMessageType = 'ACTION_TRACKED' | 'EFFECT_EVENT' | 'TIMELINE_CLEARED';


export interface DevToolMessage {
  readonly type: DevToolMessageType;
  readonly action?: string;
  readonly payload?: unknown;
  readonly isEffectResult?: boolean;
  readonly effectName?: string;
  readonly correlationId?: string;
  readonly effectEvent?: DevToolEffectEventPayload;
  readonly timestamp: string;
}

export interface DevToolEffectEventPayload {
  readonly name: string;
  readonly lifecycle: string;
  readonly duration?: number;
  readonly executionId?: string;
  readonly dispatch?: boolean;
  readonly errorMessage?: string;
  readonly errorStack?: string;
}
