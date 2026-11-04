import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type HistoryDirection = 'all' | 'in' | 'out';

/** Stateless controls: all decisions remain in MainPage's single state model. */
@Component({
  selector: 'app-history-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="direction-row" [attr.aria-label]="zh() ? '通话类型' : 'Call direction'">
      @for (option of directions; track option.key) {
        <button type="button" [class.active]="direction() === option.key"
          [attr.aria-pressed]="direction() === option.key" (click)="directionChange.emit(option.key)">
          {{ zh() ? option.zh : option.en }}
        </button>
      }
    </nav>
    <div class="summary-row">
      <div class="counts" aria-live="polite">
        <span>{{ zh() ? '录音' : 'Recordings' }} {{ total() }}</span>
        <span>{{ zh() ? '联系人' : 'Contacts' }} {{ contactCount() }}</span>
        @if (hasFilter()) { <span>{{ zh() ? '匹配' : 'Matches' }} {{ matches() }}</span> }
      </div>
      <div class="controls">
        <button class="icon-button" type="button" [disabled]="refreshing()"
          (click)="refresh.emit()" [attr.aria-label]="zh() ? '刷新录音' : 'Refresh recordings'">
          <span aria-hidden="true">{{ refreshing() ? '◌' : '↻' }}</span>
        </button>
        <button class="view-mode" type="button" (click)="toggleView.emit()"
          [attr.aria-pressed]="allRecordings()">
          {{ allRecordings() ? (zh() ? '按联系人' : 'By contact') : (zh() ? '逐条查看' : 'All recordings') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; background:var(--ion-background-color); }
    .direction-row {display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--ion-color-step-150);}
    .direction-row button {flex:1;min-width:0;border:0;border-radius:20px;padding:8px 6px;font-size:13px;
      background:var(--ion-color-step-100);color:var(--ion-text-color);}
    .direction-row button.active {background:var(--ion-color-primary);
      color:var(--ion-color-primary-contrast);font-weight:600;}
    .summary-row {display:flex;align-items:center;justify-content:space-between;gap:8px;
      padding:7px 14px;border-bottom:1px solid var(--ion-color-step-150);}
    .counts {display:flex;gap:10px;flex-wrap:wrap;min-width:0;font-size:12px;color:var(--ion-color-step-650);}
    .controls {display:flex;gap:7px;align-items:center;white-space:nowrap;}
    .controls button {height:32px;border:1px solid var(--ion-color-step-250);background:var(--ion-color-step-50);
      border-radius:8px;color:var(--ion-text-color);font-size:12px;padding:0 8px;}
    .controls button.icon-button {min-width:32px;font-size:22px;padding:0;}
    .controls button:disabled {opacity:.4;}
  `]
})
export class HistoryControlsComponent {
  readonly zh = input(false);
  readonly direction = input<HistoryDirection>('all');
  readonly total = input(0);
  readonly contactCount = input(0);
  readonly matches = input(0);
  readonly hasFilter = input(false);
  readonly allRecordings = input(false);
  readonly refreshing = input(false);
  readonly directionChange = output<HistoryDirection>();
  readonly toggleView = output<void>();
  readonly refresh = output<void>();
  protected readonly directions: {key: HistoryDirection;zh: string;en: string}[] = [
    {key:'all',zh:'全部',en:'All'},
    {key:'in',zh:'来电',en:'Incoming'},
    {key:'out',zh:'去电',en:'Outgoing'},
  ];
}
