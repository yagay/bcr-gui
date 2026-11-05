import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Recording } from 'src/app/models/recording';
import { CallIconComponent } from 'src/app/components/call-icon/call-icon.component';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { LongPressDirective } from 'src/app/directives/long-press.directive';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { I18nService } from 'src/app/services/i18n.service';

@Component({
  selector: 'app-history-recording-row',
  standalone: true,
  imports: [CallIconComponent, ToHmsPipe, LongPressDirective, DatetimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="history-entry" [class.is-child]="!isHeader()"
      [class.is-selected]="selected()" [class.is-multiselect]="multiselect()"
      longPress (longPress)="onLongPress()" (click)="onOpen()"
      role="button" tabindex="0"
      (keydown.enter)="onOpen()" (keydown.space)="onOpen(); $event.preventDefault()">
      @if (isHeader()) {
        <div class="entry-body">
          <div class="entry-heading">
            <span class="caller">{{ recording().opName || recording().opNumber || i18n.get('HISTORY_UNKNOWN') }}</span>
            @if (groupCount() > 1) { <span class="count">{{ groupCount() }}</span> }
          </div>
          <div class="entry-subtitle">
            <app-call-icon [direction]="recording().direction ?? ''" />
            <span>{{ recording().date | datetime }}</span>
            @if (recording().duration > 0) {
              <span class="duration">· {{ recording().duration | toHms }}</span>
            }
          </div>
        </div>
      } @else {
        <div class="child-branch" aria-hidden="true"></div>
        <app-call-icon class="child-direction" [direction]="recording().direction ?? ''" />
        <div class="child-info">
          <span class="child-date">{{ recording().date | datetime }}</span>
          @if (recording().duration > 0) {
            <span class="child-duration">{{ recording().duration | toHms }}</span>
          }
        </div>
      }
      @if (multiselect()) {
        @if (isHeader() && groupCount() > 1) {
          <button type="button" class="group-select"
            (click)="groupSelectClicked.emit(); $event.stopPropagation()"
            [attr.aria-label]="groupSelected()
              ? i18n.get('HISTORY_DESELECT_GROUP') : i18n.get('HISTORY_SELECT_GROUP')"
            [attr.aria-pressed]="groupSelected()">
            <span class="selection-indicator" [class.checked]="groupSelected()" [class.partial]="partial()">
              {{ groupSelected() ? '✓' : partial() ? '−' : '' }}
            </span>
          </button>
        }
        <span class="selection-indicator" [class.checked]="selected()">{{ selected() ? '✓' : '' }}</span>
      } @else {
        @if (isHeader() && groupCount() > 1) {
          <button type="button" class="expand" (click)="expandedClicked.emit(); $event.stopPropagation()"
            [attr.aria-label]="expanded() ? i18n.get('HISTORY_COLLAPSE') : i18n.get('HISTORY_EXPAND')"
            [attr.aria-expanded]="expanded()">
            <span>{{ expanded() ? '⌃' : '⌄' }}</span>
          </button>
        }
        <button class="play" type="button" (click)="playClicked.emit(); $event.stopPropagation()"
          [attr.aria-label]="playing() ? i18n.get('HISTORY_PAUSE') : i18n.get('HISTORY_PLAY')">
          <span>{{ playing() ? 'Ⅱ' : '▶' }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {display:block;box-sizing:border-box;min-width:0;contain:layout paint;}
    .history-entry {height:calc(100% - 6px);box-sizing:border-box;display:flex;align-items:center;gap:8px;
      margin:3px 12px;padding:0 12px;border-radius:10px;
      background:var(--ion-background-color);border:1px solid var(--ion-color-step-150);
      box-shadow:0 2px 5px -3px rgba(40,40,40,.25);cursor:pointer;min-width:0;}
    .history-entry.is-child {margin-left:34px;padding-left:8px;gap:7px;
      border-left:3px solid var(--ion-color-step-350);
      background:var(--ion-color-step-50);box-shadow:none;}
    .history-entry.is-selected {background:var(--ion-item-background-selected,var(--ion-color-step-100));
      border:2px solid var(--ion-color-primary);border-radius:10px 10px 0 0;
      box-shadow:0 0 0 1px var(--ion-color-primary);}
    .entry-body {min-width:0;flex:1;display:flex;flex-direction:column;gap:7px;}
    .entry-heading,.entry-subtitle {display:flex;align-items:center;gap:7px;min-width:0;}
    .caller {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:600;}
    .count {font-size:11px;border-radius:9px;padding:2px 7px;background:var(--ion-color-step-150);}
    .entry-subtitle,.child-info {color:var(--ion-color-step-600);font-size:12px;white-space:nowrap;min-width:0;}
    .entry-subtitle {overflow:hidden;}
    .entry-subtitle app-call-icon {width:14px;height:14px;flex:0 0 14px;}
    .entry-subtitle span {overflow:hidden;text-overflow:ellipsis;}
    .child-branch {width:7px;height:16px;flex:0 0 7px;border-left:1px solid var(--ion-color-step-400);
      border-bottom:1px solid var(--ion-color-step-400);margin-bottom:7px;}
    .child-direction {width:14px;height:14px;flex:0 0 14px;}
    .child-info {min-width:0;flex:1;display:flex;align-items:center;gap:8px;overflow:hidden;}
    .child-date {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
    .child-duration {font-size:11px;flex:0 0 auto;color:var(--ion-color-step-600);}
    button {border:0;background:transparent;color:var(--ion-color-primary);cursor:pointer;
      flex:0 0 38px;display:grid;place-items:center;height:44px;padding:0;font-size:20px;}
    .expand {color:var(--ion-color-step-600);}
    .play {font-size:20px;}
    .selection-indicator {height:22px;width:22px;flex:0 0 22px;border:2px solid var(--ion-color-step-500);
      border-radius:6px;display:grid;place-items:center;font-size:14px;}
    .selection-indicator.partial {border-color:var(--ion-color-primary);color:var(--ion-color-primary);}
    .group-select {flex:0 0 38px;min-width:38px;height:44px;}
    .selection-indicator.checked {background:var(--ion-color-primary);color:var(--ion-color-primary-contrast);
      border-color:var(--ion-color-primary);}
    @media(max-width:355px) {
      .history-entry {margin-inline:7px;padding-inline:8px;gap:5px;}
      .history-entry.is-child {margin-left:24px;}
      .child-duration {display:none;}
    }
  `]
})
export class HistoryRecordingRowComponent {
  readonly recording = input.required<Recording>();
  readonly isHeader = input(true);
  readonly groupCount = input(1);
  readonly expanded = input(false);
  readonly selected = input(false);
  readonly partial = input(false);
  readonly groupSelected = input(false);
  readonly playing = input(false);
  readonly multiselect = input(false);
  protected readonly i18n = inject(I18nService);
  readonly opened = output<void>();
  readonly playClicked = output<void>();
  readonly expandedClicked = output<void>();
  readonly groupSelectClicked = output<void>();
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
}
