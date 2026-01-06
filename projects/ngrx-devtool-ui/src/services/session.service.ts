import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, take, race, map, switchMap, of, throwError } from 'rxjs';
import { StateChangeMessage } from '../components/performance-panel/performance-panel.component';
import { EffectEventMessage } from '../components/effects-panel/effects-panel.component';

/** Session file format version for compatibility checking */
const SESSION_FILE_VERSION = 1 as const;

/** Render timing message structure from devtools */
export interface RenderTimingMessage {
  readonly type: 'RENDER_TIMING';
  readonly actionType: string;
  readonly reducerTime: number;
  readonly renderTime: number;
  readonly totalTime: number;
  readonly timestamp: string;
}

/** Represents a saved devtools session with strongly typed data */
export interface SessionData {
  readonly version: number;
  readonly exportedAt: string;
  readonly appName?: string;
  readonly messages: readonly StateChangeMessage[];
  readonly effectEvents: readonly EffectEventMessage[];
  readonly renderTimings: ReadonlyArray<readonly [string, RenderTimingMessage]>;
}

/** Result type for session import operations */
export type SessionImportResult =
  | { readonly success: true; readonly data: SessionData }
  | { readonly success: false; readonly error: SessionImportError };

/** Typed error categories for session imports */
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
  /**
   * Exports session data to a JSON file and triggers download.
   * Uses strongly typed parameters for type safety.
   */
  exportSession(
    messages: readonly StateChangeMessage[],
    effectEvents: readonly EffectEventMessage[],
    renderTimings: ReadonlyMap<string, RenderTimingMessage>,
    appName?: string
  ): void {
    const sessionData: SessionData = {
      version: SESSION_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      appName,
      messages,
      effectEvents,
      renderTimings: Array.from(renderTimings.entries()),
    };

    const json = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = this.generateFilename(appName);

    this.triggerDownload(url, filename);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports session data from a JSON file using reactive patterns.
   * Returns an Observable that emits the parsed session data or an error result.
   */
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

  /**
   * Legacy Promise-based import for backwards compatibility.
   * Prefer importSession$() for new code.
   */
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

  /** Reads file content and parses as SessionData */
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

  /** Parses JSON content and validates structure */
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

  /** Type-safe validation with detailed error reporting */
  private validateSessionData(data: unknown): { valid: true } | { valid: false; reason: string } {
    if (data === null || typeof data !== 'object') {
      return { valid: false, reason: 'Data is not an object' };
    }

    const record = data as Record<string, unknown>;

    if (typeof record['version'] !== 'number') {
      return { valid: false, reason: 'Missing or invalid version field' };
    }

    if (typeof record['exportedAt'] !== 'string') {
      return { valid: false, reason: 'Missing or invalid exportedAt field' };
    }

    if (!Array.isArray(record['messages'])) {
      return { valid: false, reason: 'Missing or invalid messages array' };
    }

    if (!Array.isArray(record['effectEvents'])) {
      return { valid: false, reason: 'Missing or invalid effectEvents array' };
    }

    if (!Array.isArray(record['renderTimings'])) {
      return { valid: false, reason: 'Missing or invalid renderTimings array' };
    }

    return { valid: true };
  }

  /** Creates a hidden file input element configured for JSON files */
  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    return input;
  }

  /** Generates a timestamped filename for session export */
  private generateFilename(appName?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return appName
      ? `ngrx-session-${appName}-${timestamp}.json`
      : `ngrx-session-${timestamp}.json`;
  }

  /** Triggers file download via temporary anchor element */
  private triggerDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /** Formats import error for user display */
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
