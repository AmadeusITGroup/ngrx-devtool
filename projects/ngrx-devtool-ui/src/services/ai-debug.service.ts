import { Injectable } from '@angular/core';
import { StateChangeMessage } from '../components/performance-panel';
import { EffectEventMessage } from '../components/effects-panel';
import { RenderTimingMessage } from './session.service';

const OLLAMA_BASE = 'http://localhost:11434';
const FRAME_BUDGET_MS = 16;

export type DebugFocus = 'general' | 'errors' | 'performance' | 'actions';

export interface DebugContext {
  readonly messages: readonly StateChangeMessage[];
  readonly effectEvents: readonly EffectEventMessage[];
  readonly renderTimings: ReadonlyMap<string, RenderTimingMessage>;
  readonly appName?: string | null;
}

export interface SessionSignals {
  readonly totalActions: number;
  readonly effectErrors: number;
  readonly slowRenders: number;
}

const FOCUS_QUESTIONS: Record<DebugFocus, string> = {
  general:
    'Review this NgRx session and explain what is happening. Call out anything that looks like a bug, race condition, or anti-pattern, and suggest concrete fixes.',
  errors:
    'One or more NgRx effects are failing. Using the error messages, stack traces and the action/effect flow below, diagnose the most likely root cause and propose a concrete code fix.',
  performance:
    'Some state changes are causing slow renders. Identify which actions are expensive, explain the likely cause, and give specific Angular/NgRx optimizations (OnPush, memoized selectors, trackBy, etc.).',
  actions:
    'Walk through the sequence of actions and effects below. Explain the flow they represent, whether the ordering and causality look correct, and flag anything unexpected.',
};

@Injectable({ providedIn: 'root' })
export class AiDebugService {
  computeSignals(ctx: DebugContext): SessionSignals {
    return {
      totalActions: ctx.messages.length,
      effectErrors: ctx.effectEvents.filter((e) => e.effectEvent?.lifecycle === 'error').length,
      slowRenders: ctx.messages.filter((m) => (m.renderTiming?.totalTime ?? 0) > FRAME_BUDGET_MS).length,
    };
  }

  suggestFocus(signals: SessionSignals): DebugFocus {
    if (signals.effectErrors > 0) return 'errors';
    if (signals.slowRenders > 0) return 'performance';
    return 'general';
  }

  buildPrompt(ctx: DebugContext, focus: DebugFocus): string {
    const lines: string[] = [];

    lines.push('You are an expert Angular + NgRx debugging assistant.');
    lines.push(FOCUS_QUESTIONS[focus]);
    lines.push('');
    lines.push('## Session context');
    if (ctx.appName) lines.push(`App: ${ctx.appName}`);

    const signals = this.computeSignals(ctx);
    lines.push(
      `Captured ${signals.totalActions} actions, ${ctx.effectEvents.length} effect events, ` +
        `${signals.effectErrors} effect error(s), ${signals.slowRenders} slow render(s) (> ${FRAME_BUDGET_MS}ms).`
    );

    const errorsBlock = this.buildEffectErrorsBlock(ctx);
    if (errorsBlock) {
      lines.push('');
      lines.push('## Effect errors');
      lines.push(errorsBlock);
    }

    const perfBlock = this.buildPerformanceBlock(ctx);
    if (perfBlock) {
      lines.push('');
      lines.push('## Slowest renders');
      lines.push(perfBlock);
    }

    lines.push('');
    lines.push('## Recent action timeline (oldest → newest)');
    lines.push(this.buildTimelineBlock(ctx));

    const diffBlock = this.buildLastDiffBlock(ctx);
    if (diffBlock) {
      lines.push('');
      lines.push('## State change for the most recent action');
      lines.push(diffBlock);
    }

    lines.push('');
    lines.push('## What I need');
    lines.push(FOCUS_QUESTIONS[focus]);
    lines.push('Be specific and reference action types and state paths from the data above.');

    return lines.join('\n');
  }

  private buildEffectErrorsBlock(ctx: DebugContext): string {
    const errors = ctx.effectEvents.filter((e) => e.effectEvent?.lifecycle === 'error');
    if (errors.length === 0) return '';
    return errors
      .slice(-5)
      .map((e) => {
        const name = e.effectName ?? e.effectEvent?.name ?? 'unknown effect';
        const msg = e.effectEvent?.errorMessage ?? '(no message)';
        const stack = e.effectEvent?.errorStack ? `\n    ${e.effectEvent.errorStack.split('\n').slice(0, 4).join('\n    ')}` : '';
        const trigger = e.action ? ` (action: ${e.action})` : '';
        return `- ${name}${trigger}: ${msg}${stack}`;
      })
      .join('\n');
  }

  private buildPerformanceBlock(ctx: DebugContext): string {
    const timed = ctx.messages
      .map((m) => ({ type: m.action?.type, ms: m.renderTiming?.totalTime }))
      .filter((t): t is { type: string; ms: number } => typeof t.ms === 'number' && t.ms > FRAME_BUDGET_MS);
    if (timed.length === 0) return '';
    return timed
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((t) => `- ${t.type}: ${t.ms.toFixed(1)}ms`)
      .join('\n');
  }

  private buildTimelineBlock(ctx: DebugContext): string {
    const recent = ctx.messages.slice(-15);
    if (recent.length === 0) return '(no actions captured)';
    return recent
      .map((m) => {
        const source = m.isEffectResult ? 'effect' : 'user';
        const effect = m.effectName ? ` via ${m.effectName}` : '';
        const ms = m.renderTiming?.totalTime ? ` [${m.renderTiming.totalTime.toFixed(1)}ms]` : '';
        const warn = (m.performance?.warnings?.length ?? 0) > 0 ? ' ⚠' : '';
        return `- ${m.action?.type ?? '[unknown]'} (${source}${effect})${ms}${warn}`;
      })
      .join('\n');
  }

  private buildLastDiffBlock(ctx: DebugContext): string {
    const msgs = ctx.messages;
    if (msgs.length === 0) return '';
    const current = msgs[msgs.length - 1];
    const previous = msgs.length > 1 ? msgs[msgs.length - 2] : undefined;
    const changes = this.diff(previous?.nextState, current.nextState);
    if (changes.length === 0) return `Action \`${current.action?.type}\` produced no detectable state change.`;
    const body = changes
      .slice(0, 20)
      .map((c) => `- ${c.path}: ${this.short(c.before)} → ${this.short(c.after)}`)
      .join('\n');
    return `Action \`${current.action?.type}\` changed:\n${body}`;
  }

  private diff(
    before: unknown,
    after: unknown,
    base = '',
    out: { path: string; before: unknown; after: unknown }[] = []
  ): { path: string; before: unknown; after: unknown }[] {
    if (out.length >= 40 || before === after) return out;
    const bothObjects =
      this.isIndexable(before) && this.isIndexable(after) &&
      Array.isArray(before) === Array.isArray(after);
    if (!bothObjects) {
      out.push({ path: base || '(root)', before, after });
      return out;
    }
    const keys = Object.keys(before);
    for (const k of Object.keys(after)) {
      if (!(k in before)) keys.push(k);
    }
    for (const key of keys) {
      const path = base ? `${base}.${key}` : key;
      if (!(key in before)) out.push({ path, before: undefined, after: after[key] });
      else if (!(key in after)) out.push({ path, before: before[key], after: undefined });
      else this.diff(before[key], after[key], path, out);
      if (out.length >= 40) break;
    }
    return out;
  }

  private short(value: unknown): string {
    let s: string;
    try {
      s = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      s = String(value);
    }
    if (s === undefined) s = 'undefined';
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  }

  async detectOllama(): Promise<string[] | null> {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: 'GET' });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const modelsValue = this.isIndexable(data) ? data['models'] : undefined;
      const models: string[] = Array.isArray(modelsValue)
        ? modelsValue
            .map((model) => this.isIndexable(model) ? model['name'] : undefined)
            .filter((name): name is string => typeof name === 'string')
        : [];
      return models;
    } catch {
      return null;
    }
  }

  async streamOllama(
    model: string,
    prompt: string,
    onToken: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama responded with ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const chunk = json?.message?.content;
          if (typeof chunk === 'string' && chunk) onToken(chunk);
        } catch {
          continue;
        }
      }
    }
  }

  private isIndexable(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }
}
