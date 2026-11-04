import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';

export type HistoryDirection = 'all' | 'in' | 'out' | 'voip';

/** Stateless controls: all decisions remain in MainPage's single state model. */
@Component({
  selector: 'app-history-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-row">
      <input type="search" [value]="search()" (input)="searchChange.emit($any($event.target).value)"
        [placeholder]="zh() ? '搜索联系人或号码' : 'Search contacts or numbers'"
        [attr.aria-label]="zh() ? '搜索录音' : 'Search recordings'" />
      @if (search() || direction() !== 'all') {
        <button type="button" (click)="resetAll.emit()" [attr.aria-label]="zh() ? '重置筛选' : 'Reset filters'">
          {{ zh() ? '重置' : 'Reset' }}
        </button>
      }
    </div>
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
        <select class="sort-select" [value]="sortMode()" (change)="updateSort($event)"
          [attr.aria-label]="zh() ? '录音排序' : 'Sort recordings'">
          @for (option of sortOptions; track option.value) {
            <option [value]="option.value">{{ zh() ? option.zh : option.en }}</option>
          }
        </select>
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
    .search-row {display:flex;align-items:center;gap:8px;padding:9px 14px 0;}
    .search-row input {min-width:0;flex:1;min-height:38px;border:1px solid var(--ion-color-step-200);
      border-radius:9px;padding:0 12px;color:var(--ion-text-color);background:var(--ion-color-step-50);font-size:14px;}
    .search-row button {border:0;background:none;color:var(--ion-color-primary);padding:9px;white-space:nowrap;}
    .direction-row {display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--ion-color-step-150);}
    .direction-row button {flex:1;min-width:0;border:0;border-radius:20px;padding:8px 6px;font-size:13px;
      background:var(--ion-color-step-100);color:var(--ion-text-color);}
    .direction-row button.active {background:var(--ion-color-primary);
      color:var(--ion-color-primary-contrast);font-weight:600;}
    .summary-row {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
      padding:7px 14px;border-bottom:1px solid var(--ion-color-step-150);}
    .counts {display:flex;gap:10px;flex-wrap:wrap;min-width:0;font-size:12px;color:var(--ion-color-step-650);}
    .controls {display:flex;gap:7px;align-items:center;white-space:nowrap;min-width:0;max-width:100%;}
    .controls button {height:32px;border:1px solid var(--ion-color-step-250);background:var(--ion-color-step-50);
      border-radius:8px;color:var(--ion-text-color);font-size:12px;padding:0 8px;}
    .controls button.icon-button {min-width:32px;font-size:22px;padding:0;}
    .controls button:disabled {opacity:.4;}
    .sort-select {max-width:118px;min-width:0;height:32px;border-radius:8px;border:1px solid var(--ion-color-step-250);background:var(--ion-color-step-50);color:var(--ion-text-color);font-size:12px;}
  `]
})
export class HistoryControlsComponent {
  readonly zh = input(false);
  readonly search = input('');
  readonly searchChange = output<string>();
  readonly resetAll = output<void>();
  readonly direction = input<HistoryDirection>('all');
  readonly total = input(0);
  readonly contactCount = input(0);
  readonly matches = input(0);
  readonly hasFilter = input(false);
  readonly allRecordings = input(false);
  readonly refreshing = input(false);
  readonly sortMode = input<SortModeEnum>(SortModeEnum.Date_DESC);
  readonly sortChange = output<SortModeEnum>();
  readonly directionChange = output<HistoryDirection>();
  readonly toggleView = output<void>();
  readonly refresh = output<void>();
  protected readonly sortOptions = [
    {value:SortModeEnum.Date_DESC,zh:'最新优先',en:'Newest'},
    {value:SortModeEnum.Date_ASC,zh:'最早优先',en:'Oldest'},
    {value:SortModeEnum.Duration_DESC,zh:'最长优先',en:'Longest'},
    {value:SortModeEnum.Duration_ASC,zh:'最短优先',en:'Shortest'},
  ];
  protected updateSort(event: Event): void {
    const selected = Number((event.target as HTMLSelectElement).value);
    if (this.sortOptions.some(option => option.value === selected)) {
      this.sortChange.emit(selected as SortModeEnum);
    }
  }
  protected readonly directions: {key: HistoryDirection;zh: string;en: string}[] = [
    {key:'all',zh:'全部',en:'All'},
    {key:'in',zh:'来电',en:'Incoming'},
    {key:'out',zh:'去电',en:'Outgoing'},
    {key:'voip',zh:'VoIP',en:'VoIP'},
  ];
}
