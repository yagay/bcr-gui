import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Recording } from 'src/app/models/recording';
import { CallIconComponent } from 'src/app/components/call-icon/call-icon.component';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { LongPressDirective } from 'src/app/directives/long-press.directive';

@Component({
  selector: 'app-history-recording-row',
  standalone: true,
  imports: [CallIconComponent, ToHmsPipe, LongPressDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="history-entry" [class.is-child]="!isHeader()" [class.is-selected]="selected()"
      [class.is-multiselect]="multiselect()" longPress (longPress)="onLongPress()"
      (click)="onOpen()" role="button" tabindex="0"
      (keydown.enter)="onOpen()" (keydown.space)="onOpen(); $event.preventDefault()">
      <div class="avatar"><span>{{ avatarLetter() }}</span></div>
      <div class="entry-body">
        <div class="entry-heading">
          <span class="caller">{{ recording().opName || recording().opNumber || (zh() ? '未知号码' : 'Unknown') }}</span>
          @if (isHeader() && groupCount() > 1) {
            <span class="count">{{ groupCount() }}</span>
          }
        </div>
        <div class="entry-subtitle">
          <app-call-icon [direction]="recording().direction ?? ''" />
          <span>{{ formattedDate() }}</span>
          @if (recording().duration > 0) {
            <span class="duration">· {{ recording().duration | toHms }}</span>
          }
        </div>
      </div>
      @if (multiselect()) {
        <span class="selection-indicator" [class.checked]="selected()" [class.partial]="partial()">{{ selected() ? '✓' : partial() ? '−' : '' }}</span>
      } @else {
        @if (isHeader() && groupCount() > 1) {
          <button type="button" class="expand" (click)="expandedClicked.emit(); $event.stopPropagation()"
            [attr.aria-label]="expanded() ? (zh() ? '收起' : 'Collapse') : (zh() ? '展开' : 'Expand')"
            [attr.aria-expanded]="expanded()">
            <span>{{ expanded() ? '⌃' : '⌄' }}</span>
          </button>
        }
        <button class="play" type="button" (click)="playClicked.emit(); $event.stopPropagation()"
          [attr.aria-label]="playing() ? (zh() ? '暂停' : 'Pause') : (zh() ? '播放' : 'Play')">
          <span>{{ playing() ? 'Ⅱ' : '▶' }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display:block; box-sizing:border-box; height:78px; contain:layout paint size; }
    .history-entry { height:100%; box-sizing:border-box; display:flex; align-items:center; padding:0 12px;
      gap:12px; border-bottom:1px solid var(--ion-color-step-150);
      background:var(--ion-background-color); cursor:pointer; min-width:0; }
    .history-entry.is-child { padding-left:30px; background:var(--ion-color-step-50); }
    .history-entry.is-selected { background:var(--ion-color-step-100); border-left:3px solid var(--ion-color-primary); }
    .avatar { flex:0 0 42px; width:42px; height:42px; display:grid;place-items:center;
      border-radius:50%; background:var(--ion-color-step-150); color:var(--ion-color-step-700); font-weight:600; }
    .is-child .avatar { width:32px;height:32px;flex-basis:32px;font-size:13px; }
    .entry-body { min-width:0;flex:1;display:flex;flex-direction:column;gap:7px; }
    .entry-heading,.entry-subtitle { display:flex;align-items:center;gap:7px;min-width:0; }
    .caller { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600; }
    .is-child .caller { font-weight:400; }
    .count {font-size:11px;border-radius:9px;padding:2px 6px;background:var(--ion-color-step-150); }
    .entry-subtitle {color:var(--ion-color-step-600);font-size:12px;white-space:nowrap;overflow:hidden;}
    .entry-subtitle app-call-icon {width:14px;height:14px;flex:0 0 14px;}
    .entry-subtitle span {overflow:hidden;text-overflow:ellipsis;}
    button {border:0;background:transparent;color:var(--ion-color-primary);cursor:pointer;
      flex:0 0 32px;display:grid;place-items:center;height:42px;padding:0;font-size:22px;}
    .expand {color:var(--ion-color-step-550);}
    .play {font-size:21px;}
    .selection-indicator {height:22px;width:22px;flex:0 0 22px;border:2px solid var(--ion-color-step-500);
      border-radius:6px;display:grid;place-items:center;font-size:14px;}
    .selection-indicator.partial {border-color:var(--ion-color-primary);color:var(--ion-color-primary);}
    .selection-indicator.checked {background:var(--ion-color-primary);color:var(--ion-color-primary-contrast);border-color:var(--ion-color-primary);}
  `]
})
export class HistoryRecordingRowComponent {
  readonly recording = input.required<Recording>();
  readonly isHeader = input(true);
  readonly groupCount = input(1);
  readonly expanded = input(false);
  readonly selected = input(false);
  readonly partial = input(false);
  readonly playing = input(false);
  readonly multiselect = input(false);
  readonly zh = input(false);
  readonly hour12 = input(false);
  readonly opened = output<void>();
  readonly playClicked = output<void>();
  readonly expandedClicked = output<void>();
  readonly longPressed = output<void>();

  private suppressClick = false;

  protected onLongPress(): void {
    this.suppressClick = true;
    this.longPressed.emit();
    setTimeout(() => this.suppressClick = false, 550);
  }

  protected onOpen(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.opened.emit();
  }

  protected avatarLetter(): string {
    const r = this.recording();
    const name = r.opName || r.opNumber || '?';
    return name.slice(0, 1).toUpperCase();
  }
  protected formattedDate(): string {
    const date = this.recording().date;
    if (!Number.isFinite(date) || date <= 0) return '';
    return new Intl.DateTimeFormat(this.zh() ? 'zh-CN' : 'en-GB', {
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:this.hour12()
    }).format(new Date(date));
  }
}
