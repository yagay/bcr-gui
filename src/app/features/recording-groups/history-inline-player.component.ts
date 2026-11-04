import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';

/**
 * A single view of the shared native audio engine. It can render either as
 * one 78px virtual-scroll row or as a small dock when the contact is folded.
 */
@Component({
  selector: 'app-history-inline-player',
  standalone: true,
  imports: [ToHmsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-player" role="group" [attr.aria-label]="zh() ? '录音播放控制' : 'Recording playback controls'">
      <div class="timeline">
        <span>{{ position() | toHms }}</span>
        <input type="range" min="0" [max]="duration() || 1" [value]="position()"
          [disabled]="!ready()" (input)="preview.emit(+$any($event.target).value)"
          (change)="seek.emit(+$any($event.target).value)"
          [attr.aria-label]="zh() ? '播放进度' : 'Playback position'" />
        <span>{{ duration() | toHms }}</span>
      </div>
      <div class="buttons">
        <button type="button" (click)="previous.emit()" [disabled]="!ready() || !canPrevious()"
          [attr.aria-label]="zh() ? '上一条录音' : 'Previous recording'">⏮</button>
        <button type="button" (click)="rewind.emit()" [disabled]="!ready()"
          [attr.aria-label]="zh() ? '快退' : 'Rewind'">{{ '−' + seekSeconds() }}</button>
        <button type="button" class="toggle" (click)="toggle.emit()" [disabled]="!ready() && !failed()"
          [attr.aria-label]="failed() ? 'Retry' : playing() ? 'Pause' : 'Play'">
          {{ failed() ? '↻' : playing() ? 'Ⅱ' : ready() ? '▶' : '…' }}
        </button>
        <button type="button" (click)="forward.emit()" [disabled]="!ready()"
          [attr.aria-label]="zh() ? '快进' : 'Forward'">{{ '+' + seekSeconds() }}</button>
        <button type="button" (click)="next.emit()" [disabled]="!ready() || !canNext()"
          [attr.aria-label]="zh() ? '下一条录音' : 'Next recording'">⏭</button>
        <button type="button" class="speed" (click)="speedChange.emit()" [disabled]="!ready()"
          [attr.aria-label]="zh() ? '播放倍速' : 'Playback speed'">{{ speed() }}×</button>
        <button type="button" (click)="dismiss.emit()" [attr.aria-label]="zh() ? '关闭播放器' : 'Close player'">×</button>
      </div>
    </div>
  `,
  styles: [`
    :host {display:block;height:78px;box-sizing:border-box;min-width:0;}
    .inline-player {height:78px;box-sizing:border-box;background:var(--ion-color-step-50);
      border-bottom:1px solid var(--ion-color-step-200);padding:5px 8px 6px;
      display:flex;flex-direction:column;gap:3px;}
    .timeline {display:flex;gap:8px;align-items:center;height:27px;font-size:11px;color:var(--ion-color-step-700);}
    .timeline input {min-width:0;flex:1;accent-color:var(--ion-color-primary);height:25px;}
    .buttons {height:33px;display:flex;justify-content:space-between;align-items:center;gap:3px;}
    .buttons button {min-width:0;flex:1 1 0;height:30px;padding:0 2px;border:0;border-radius:6px;
      background:transparent;color:var(--ion-color-primary);font-size:13px;white-space:nowrap;}
    .buttons .toggle {font-size:20px;flex:1.2 1 0;}
    .buttons .speed {font-size:12px;}
    .buttons button:disabled {opacity:.35;}
  `]
})
export class HistoryInlinePlayerComponent {
  readonly zh = input(false);
  readonly position = input(0);
  readonly duration = input(0);
  readonly playing = input(false);
  readonly ready = input(false);
  readonly failed = input(false);
  readonly speed = input(1);
  readonly seekSeconds = input(5);
  readonly canPrevious = input(false);
  readonly canNext = input(false);
  readonly preview = output<number>();
  readonly seek = output<number>();
  readonly rewind = output<void>();
  readonly forward = output<void>();
  readonly previous = output<void>();
  readonly next = output<void>();
  readonly toggle = output<void>();
  readonly speedChange = output<void>();
  readonly dismiss = output<void>();
}
