import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AiDebugService, DebugContext, DebugFocus } from '../../services/ai-debug.service';

type OllamaStatus = 'detecting' | 'available' | 'unavailable';

interface FocusOption {
  readonly value: DebugFocus;
  readonly label: string;
  readonly icon: string;
}

const FOCUS_OPTIONS: readonly FocusOption[] = [
  { value: 'general', label: 'Health check', icon: 'health_and_safety' },
  { value: 'errors', label: 'Debug errors', icon: 'error' },
  { value: 'performance', label: 'Why slow?', icon: 'speed' },
  { value: 'actions', label: 'Explain flow', icon: 'account_tree' },
];

@Component({
  selector: 'app-ai-debug-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="ai-title">
      <mat-icon>auto_awesome</mat-icon>
      Debug with AI
    </h2>

    <mat-dialog-content class="ai-content">
      <p class="ai-summary">
        {{ signals().totalActions }} actions ·
        <span [class.has-errors]="signals().effectErrors > 0">{{ signals().effectErrors }} effect error(s)</span> ·
        {{ signals().slowRenders }} slow render(s)
      </p>

      <div class="focus-chips">
        @for (opt of focusOptions; track opt.value) {
          <button
            type="button"
            class="focus-chip"
            [class.active]="focus() === opt.value"
            (click)="setFocus(opt.value)"
          >
            <mat-icon>{{ opt.icon }}</mat-icon>
            {{ opt.label }}
          </button>
        }
      </div>

      <label class="ai-label" for="ai-prompt">Prompt (editable)</label>
      <textarea
        id="ai-prompt"
        class="ai-prompt"
        [value]="prompt()"
        (input)="onPromptEdit($event)"
        spellcheck="false"
      ></textarea>

      <div class="ai-actions-row">
        <button mat-flat-button color="primary" (click)="copyPrompt()">
          <mat-icon>content_copy</mat-icon>
          Copy prompt
        </button>
        <span class="ai-hint">Paste into Copilot Chat, Claude, ChatGPT, or run it locally below.</span>
      </div>

      <div class="ollama-section">
        <div class="ollama-header">
          <mat-icon class="ollama-dot" [class]="ollamaStatus()">circle</mat-icon>
          <span class="ollama-title">Local Ollama</span>
          @switch (ollamaStatus()) {
            @case ('detecting') { <span class="ollama-state">detecting…</span> }
            @case ('available') { <span class="ollama-state ok">connected ({{ models().length }} model(s))</span> }
            @case ('unavailable') { <span class="ollama-state">not detected; copy works everywhere</span> }
          }
          <button mat-icon-button matTooltip="Re-detect Ollama" (click)="detect()" [disabled]="streaming()">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        @if (ollamaStatus() === 'available') {
          <div class="ollama-run">
            <mat-form-field appearance="outline" class="model-select" subscriptSizing="dynamic">
              <mat-label>Model</mat-label>
              <mat-select [value]="selectedModel()" (valueChange)="selectedModel.set($event)" [disabled]="streaming()">
                @for (m of models(); track m) {
                  <mat-option [value]="m">{{ m }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (!streaming()) {
              <button mat-flat-button color="primary" (click)="askOllama()" [disabled]="!selectedModel()">
                <mat-icon>send</mat-icon>
                Ask {{ selectedModel() }}
              </button>
            } @else {
              <button mat-stroked-button (click)="stopOllama()">
                <mat-icon>stop</mat-icon>
                Stop
              </button>
            }
          </div>

          @if (streaming()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          @if (response()) {
            <pre class="ollama-response">{{ response() }}</pre>
          }
          @if (ollamaError()) {
            <p class="ollama-err"><mat-icon>warning</mat-icon> {{ ollamaError() }}</p>
          }
        } @else if (ollamaStatus() === 'unavailable') {
          <p class="ollama-tip">
            Want free, fully local AI answers? Install <strong>Ollama</strong>, run
            <code>ollama pull llama3</code>, then hit re-detect. The copy button works with any assistant in the meantime.
          </p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .ai-title { display: flex; align-items: center; gap: 8px; }
      .ai-title mat-icon { color: var(--mat-sys-primary); }
      .ai-content { display: flex; flex-direction: column; gap: 12px; min-width: 520px; max-width: 720px; }
      .ai-summary { margin: 0; color: var(--mat-sys-on-surface-variant); font-size: 13px; }
      .ai-summary .has-errors { color: #f44336; font-weight: 600; }

      .focus-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .focus-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 16px; cursor: pointer;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface); font-size: 13px;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .focus-chip:hover { background: var(--mat-sys-surface-container-high); }
      .focus-chip.active {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        border-color: var(--mat-sys-primary);
      }
      .focus-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }

      .ai-label { font-size: 12px; color: var(--mat-sys-on-surface-variant); font-weight: 500; }
      .ai-prompt {
        width: 100%; box-sizing: border-box; min-height: 160px; max-height: 280px; resize: vertical;
        font-family: 'Roboto Mono', monospace; font-size: 12px; line-height: 1.5;
        padding: 10px; border-radius: 8px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-container-low);
        color: var(--mat-sys-on-surface);
      }

      .ai-actions-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .ai-hint { font-size: 12px; color: var(--mat-sys-on-surface-variant); }

      .ollama-section {
        border-top: 1px solid var(--mat-sys-outline-variant);
        padding-top: 12px; display: flex; flex-direction: column; gap: 10px;
      }
      .ollama-header { display: flex; align-items: center; gap: 8px; }
      .ollama-title { font-weight: 600; font-size: 13px; }
      .ollama-state { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
      .ollama-state.ok { color: #4caf50; }
      .ollama-dot { font-size: 12px; width: 12px; height: 12px; }
      .ollama-dot.detecting { color: #ff9800; }
      .ollama-dot.available { color: #4caf50; }
      .ollama-dot.unavailable { color: var(--mat-sys-outline); }

      .ollama-run { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .model-select { min-width: 220px; }

      .ollama-response {
        white-space: pre-wrap; word-break: break-word; margin: 0; padding: 12px;
        font-family: 'Roboto Mono', monospace; font-size: 12px; line-height: 1.5;
        max-height: 260px; overflow: auto; border-radius: 8px;
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);
      }
      .ollama-err { display: flex; align-items: center; gap: 6px; color: #f44336; font-size: 12px; margin: 0; }
      .ollama-err mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .ollama-tip { font-size: 12px; color: var(--mat-sys-on-surface-variant); margin: 0; line-height: 1.5; }
      .ollama-tip code { background: var(--mat-sys-surface-container); padding: 1px 5px; border-radius: 4px; }
    `,
  ],
})
export class AiDebugDialogComponent implements OnInit, OnDestroy {
  private readonly ai = inject(AiDebugService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly data = inject<DebugContext>(MAT_DIALOG_DATA);

  readonly focusOptions = FOCUS_OPTIONS;
  readonly signals = signal(this.ai.computeSignals(this.data));
  readonly focus = signal<DebugFocus>(this.ai.suggestFocus(this.ai.computeSignals(this.data)));
  readonly prompt = signal('');

  readonly ollamaStatus = signal<OllamaStatus>('detecting');
  readonly models = signal<string[]>([]);
  readonly selectedModel = signal<string>('');
  readonly response = signal('');
  readonly streaming = signal(false);
  readonly ollamaError = signal('');

  private abort?: AbortController;
  private promptEdited = false;

  ngOnInit(): void {
    this.regeneratePrompt();
    this.detect();
  }

  ngOnDestroy(): void {
    this.abort?.abort();
  }

  setFocus(focus: DebugFocus): void {
    this.focus.set(focus);
    if (!this.promptEdited) this.regeneratePrompt();
  }

  onPromptEdit(event: Event): void {
    this.promptEdited = true;
    this.prompt.set((event.target as HTMLTextAreaElement).value);
  }

  private regeneratePrompt(): void {
    this.prompt.set(this.ai.buildPrompt(this.data, this.focus()));
  }

  async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.prompt());
      this.snackBar.open('Prompt copied. Paste into your AI assistant', 'Close', { duration: 3000 });
    } catch {
      this.snackBar.open('Could not access clipboard. Select the text and copy manually', 'Close', { duration: 4000 });
    }
  }

  async detect(): Promise<void> {
    this.ollamaStatus.set('detecting');
    const models = await this.ai.detectOllama();
    if (models && models.length > 0) {
      this.models.set(models);
      this.selectedModel.set(models[0]);
      this.ollamaStatus.set('available');
    } else if (models) {
      this.ollamaStatus.set('unavailable');
    } else {
      this.ollamaStatus.set('unavailable');
    }
  }

  async askOllama(): Promise<void> {
    const model = this.selectedModel();
    if (!model) return;
    this.response.set('');
    this.ollamaError.set('');
    this.streaming.set(true);
    this.abort = new AbortController();
    try {
      await this.ai.streamOllama(model, this.prompt(), (chunk) => {
        this.response.update((r) => r + chunk);
      }, this.abort.signal);
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        this.ollamaError.set(err instanceof Error ? err.message : 'Ollama request failed');
      }
    } finally {
      this.streaming.set(false);
    }
  }

  stopOllama(): void {
    this.abort?.abort();
    this.streaming.set(false);
  }
}
