import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { I18nService } from 'src/app/services/i18n.service';
import { toHms } from 'src/app/pipes/to-hms.pipe';
import { RangeCustomEvent } from '@ionic/angular';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';

/**
 * A single view of the shared native audio engine. It can render either as
 * one measured virtual-scroll row or as a compact dock when the call scrolls away.
 */
@Component({
  selector: 'app-history-inline-player',
  standalone: true,
  imports: [IonicBundleModule, ToHmsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-player" role="group" [attr.aria-label]="i18n.get('HISTORY_PLAYER')">
      <div class="timeline">
        <span>{{ position() | toHms }}</span>
        <ion-range class="range-bar" [min]="0" [max]="duration() || 1"
          [value]="dragging() ? dragValue() : position()" [disabled]="!ready()"
          [pin]="true" [pinFormatter]="formatPin"
          [step]="duration() > 600 ? 10 : duration() > 180 ? 5 : 1"
          [snaps]="true" [ticks]="false"
          (ionKnobMoveStart)="onDragStart()"
          (ionInput)="onRangePreview($event)"
          (ionKnobMoveEnd)="onDragEnd()"
          (ionChange)="onRangeCommit($event)"
          [attr.aria-label]="i18n.get('HISTORY_POSITION')" />
        <span>{{ duration() | toHms }}</span>
      </div>
      <div class="buttons">
        <button type="button" (click)="previous.emit()" [disabled]="!ready() || !canPrevious()"
          [attr.aria-label]="i18n.get('HISTORY_PREVIOUS')">⏮</button>
        <button type="button" (click)="rewind.emit()" [disabled]="!ready()"
          [attr.aria-label]="i18n.get('HISTORY_REWIND')">{{ '−' + seekSeconds() }}</button>
        <button type="button" class="toggle" (click)="toggle.emit()" [disabled]="!ready() && !failed()"
          [attr.aria-label]="failed() ? i18n.get('HISTORY_RETRY') : playing() ? i18n.get('HISTORY_PAUSE') : i18n.get('HISTORY_PLAY')">
          {{ failed() ? '↻' : playing() ? 'Ⅱ' : ready() ? '▶' : '…' }}
        </button>
        <button type="button" (click)="forward.emit()" [disabled]="!ready()"
          [attr.aria-label]="i18n.get('HISTORY_FORWARD')">{{ '+' + seekSeconds() }}</button>
        <button type="button" (click)="next.emit()" [disabled]="!ready() || !canNext()"
          [attr.aria-label]="i18n.get('HISTORY_NEXT')">⏭</button>
        <button type="button" class="speed" (click)="speedChange.emit()" [disabled]="!ready()"
          [attr.aria-label]="i18n.get('HISTORY_SPEED')">{{ speed() }}×</button>
        <button type="button" (click)="dismiss.emit()" [attr.aria-label]="i18n.get('HISTORY_CLOSE')">×</button>
      </div>
    </div>
  `,
  styles: [`
    :host {display:block;height:90px;box-sizing:border-box;min-width:0;}
    .inline-player {height:100%;box-sizing:border-box;background:var(--ion-color-step-50);
      border-bottom:1px solid var(--ion-color-step-200);padding:8px 8px 6px;
      display:flex;flex-direction:column;gap:3px;}
    .timeline {display:flex;gap:8px;align-items:center;height:32px;font-size:11px;color:var(--ion-color-step-700);}
    .timeline ion-range {min-width:0;flex:1;height:28px;padding:0;--bar-height:4px;--knob-size:16px;--pin-background:var(--ion-color-primary);}
    .buttons {height:42px;display:flex;justify-content:space-between;align-items:center;gap:2px;}
    .buttons button {min-width:36px;flex:1 1 0;height:42px;padding:0 2px;border:0;border-radius:6px;
      background:transparent;color:var(--ion-color-primary);font-size:13px;white-space:nowrap;}
    .buttons .toggle {font-size:20px;flex:1.2 1 0;}
    .buttons .speed {font-size:12px;}
    .buttons button:disabled {opacity:.35;}
    @media (max-width:350px) { .inline-player {padding-inline:3px;} .buttons button {min-width:32px;font-size:11px;} }
  `]
})
export class HistoryInlinePlayerComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly dragging = signal(false);
  protected readonly dragValue = signal(0);
  protected formatPin = (value: number) => toHms(value);
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
  protected onDragStart(): void {
    this.dragging.set(true);
    this.dragValue.set(this.position());
  }
  protected onRangePreview(event: RangeCustomEvent): void {
    const value = Number(event.detail.value);
    if (!Number.isFinite(value)) return;
    if (this.dragging()) this.dragValue.set(value);
    this.preview.emit(value);
  }
  protected onDragEnd(): void {
    this.dragging.set(false);
  }
  protected onRangeCommit(event: RangeCustomEvent): void {
    const value = Number(event.detail.value);
    if (!Number.isFinite(value)) return;
    this.dragging.set(false);
    this.seek.emit(value);
  }

}
