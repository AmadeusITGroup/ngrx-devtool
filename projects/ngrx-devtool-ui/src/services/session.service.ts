import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, take, race, map, switchMap, of } from 'rxjs';
import { StateChangeMessage } from '../components/performance-panel';
import { EffectEventMessage } from '../components/effects-panel';

const SESSION_FILE_VERSION = 1 as const;

export interface RenderTimingMessage {
  readonly type: 'RENDER_TIMING';
  readonly actionType: string;
  readonly reducerTime: number;
  readonly renderTime: number;
  readonly totalTime: number;
  readonly timestamp: string;
}

export interface SessionData {
  readonly version: number;
  readonly exportedAt: string;
  readonly appName?: string;
  readonly messages: readonly StateChangeMessage[];
  readonly effectEvents: readonly EffectEventMessage[];
  readonly renderTimings: readonly (readonly [string, RenderTimingMessage])[];
}

export type SessionImportResult =
  | { readonly success: true; readonly data: SessionData }
  | { readonly success: false; readonly error: SessionImportError };

export type SessionImportError =
  | { readonly type: 'NO_FILE_SELECTED' }
  | { readonly type: 'FILE_READ_ERROR'; readonly message: string }
  | { readonly type: 'PARSE_ERROR'; readonly message: string }
  | { readonly type: 'INVALID_FORMAT'; readonly details: string }
  | { readonly type: 'CANCELLED' };

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly CHUNK_SIZE = 1000;

  exportSession(
    messages: readonly StateChangeMessage[],
    effectEvents: readonly EffectEventMessage[],
    renderTimings: ReadonlyMap<string, RenderTimingMessage>,
    appName?: string
  ): void {
    try {
      const blob = this.buildSessionBlob(messages, effectEvents, renderTimings, appName);
      const url = URL.createObjectURL(blob);
      const filename = this.generateFilename(appName);

      this.triggerDownload(url, filename);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
      throw new Error('Export failed: Session data is too large to export. Try clearing some history first.');
    }
  }

  private buildSessionBlob(
    messages: readonly StateChangeMessage[],
    effectEvents: readonly EffectEventMessage[],
    renderTimings: ReadonlyMap<string, RenderTimingMessage>,
    appName?: string
  ): Blob {
    const parts: BlobPart[] = [];

    parts.push('{\n');
    parts.push(`  "version": ${SESSION_FILE_VERSION},\n`);
    parts.push(`  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`);
    if (appName) {
      parts.push(`  "appName": ${JSON.stringify(appName)},\n`);
    }

    parts.push('  "messages": [\n');
    this.writeArrayChunked(parts, messages, '    ');
    parts.push('  ],\n');

    parts.push('  "effectEvents": [\n');
    this.writeArrayChunked(parts, effectEvents, '    ');
    parts.push('  ],\n');

    const renderTimingsArray = Array.from(renderTimings.entries());
    parts.push('  "renderTimings": [\n');
    this.writeArrayChunked(parts, renderTimingsArray, '    ');
    parts.push('  ]\n');

    parts.push('}');

    return new Blob(parts, { type: 'application/json' });
  }

  private writeArrayChunked<T>(parts: BlobPart[], items: readonly T[], indent: string): void {
    for (let i = 0; i < items.length; i += this.CHUNK_SIZE) {
      const chunk = items.slice(i, Math.min(i + this.CHUNK_SIZE, items.length));

      for (let j = 0; j < chunk.length; j++) {
        const isLast = i + j === items.length - 1;
        const itemJson = JSON.stringify(chunk[j]);
        parts.push(`${indent}${itemJson}${isLast ? '\n' : ',\n'}`);
      }
    }
  }

  importSession$(): Observable<SessionImportResult> {
    const input = this.createFileInput();
    const cancelled$ = new Subject<void>();

    const fileSelected$ = fromEvent<Event>(input, 'change').pipe(
      take(1),
      switchMap((event) => {
        const target = event.target as HTMLInputElement | null;
        const file = target?.files?.[0];

        if (!file) {
          return of<SessionImportResult>({
            success: false,
            error: { type: 'NO_FILE_SELECTED' },
          });
        }

        return this.readAndParseFile$(file);
      })
    );

    const cancelledResult$ = cancelled$.pipe(
      map((): SessionImportResult => ({
        success: false,
        error: { type: 'CANCELLED' },
      }))
    );

    input.addEventListener('cancel', () => cancelled$.next(), { once: true });
    input.click();

    return race(fileSelected$, cancelledResult$).pipe(take(1));
  }

  importSession(): Promise<SessionData> {
    return new Promise((resolve, reject) => {
      this.importSession$().subscribe((result) => {
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(this.formatImportError(result.error)));
        }
      });
    });
  }

  private readAndParseFile$(file: File): Observable<SessionImportResult> {
    return new Observable<SessionImportResult>((subscriber) => {
      const reader = new FileReader();

      reader.onload = (event): void => {
        const content = event.target?.result;

        if (typeof content !== 'string') {
          subscriber.next({
            success: false,
            error: { type: 'FILE_READ_ERROR', message: 'File content is not text' },
          });
          subscriber.complete();
          return;
        }

        const parseResult = this.parseSessionContent(content);
        subscriber.next(parseResult);
        subscriber.complete();
      };

      reader.onerror = (): void => {
        subscriber.next({
          success: false,
          error: { type: 'FILE_READ_ERROR', message: reader.error?.message ?? 'Unknown read error' },
        });
        subscriber.complete();
      };

      reader.readAsText(file);
    });
  }

  private parseSessionContent(content: string): SessionImportResult {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      return { success: false, error: { type: 'PARSE_ERROR', message } };
    }

    const validation = this.validateSessionData(parsed);

    if (!validation.valid) {
      return { success: false, error: { type: 'INVALID_FORMAT', details: validation.reason } };
    }

    return { success: true, data: parsed as SessionData };
  }

  private validateSessionData(data: unknown): { valid: true } | { valid: false; reason: string } {
    if (data === null || typeof data !== 'object') {
      return { valid: false, reason: 'Data is not an object' };
    }

    const record = data as Record<string, unknown>;

    const validations: [boolean, string][] = [
      [typeof record['version'] === 'number', 'Missing or invalid version field'],
      [typeof record['exportedAt'] === 'string', 'Missing or invalid exportedAt field'],
      [Array.isArray(record['messages']), 'Missing or invalid messages array'],
      [Array.isArray(record['effectEvents']), 'Missing or invalid effectEvents array'],
      [Array.isArray(record['renderTimings']), 'Missing or invalid renderTimings array'],
    ];

    const failed = validations.find(([isValid]) => !isValid);
    return failed ? { valid: false, reason: failed[1] } : { valid: true };
  }

  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    return input;
  }

  private generateFilename(appName?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return appName
      ? `ngrx-session-${appName}-${timestamp}.json`
      : `ngrx-session-${timestamp}.json`;
  }

  private triggerDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private formatImportError(error: SessionImportError): string {
    switch (error.type) {
      case 'NO_FILE_SELECTED':
        return 'No file selected';
      case 'CANCELLED':
        return 'File selection cancelled';
      case 'FILE_READ_ERROR':
        return `Failed to read file: ${error.message}`;
      case 'PARSE_ERROR':
        return `Failed to parse session file: ${error.message}`;
      case 'INVALID_FORMAT':
        return `Invalid session file format: ${error.details}`;
    }
  }
}
