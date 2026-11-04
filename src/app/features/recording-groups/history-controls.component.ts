import { ChangeDetectionStrategy, Component, input, OnDestroy, output } from '@angular/core';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';

export type HistoryDirection = 'all' | 'in' | 'out' | 'voip';

/** Compact, reusable 2-row control bar. Inputs are state, events request changes. */
@Component({
  selector: 'app-history-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-row">
      <input type="search" [value]="search()" (input)="onSearchInput($event)"
        [placeholder]="zh() ? '搜索姓名或号码' : 'Search calls'"
        [attr.aria-label]="zh() ? '搜索录音' : 'Search recordings'" />
      @if (search() || direction() !== 'all') {
        <button type="button" class="reset" (click)="resetFilters()"
          [attr.aria-label]="zh() ? '重置搜索和筛选' : 'Reset search and filters'">×</button>
      }
      <select class="sort-select" [value]="sortMode()" (change)="updateSort($event)"
        [attr.aria-label]="zh() ? '录音排序' : 'Sort recordings'">
        @for (option of sortOptions; track option.value) {
          <option [value]="option.value">{{ zh() ? option.zh : option.en }}</option>
        }
      </select>
      <button type="button" class="refresh" [disabled]="refreshing()" (click)="refresh.emit()"
        [attr.aria-label]="zh() ? '刷新录音' : 'Refresh recordings'">
        {{ refreshing() ? '◌' : '↻' }}
      </button>
    </div>
    <div class="filter-row">
      <nav class="direction-row" [attr.aria-label]="zh() ? '通话类型' : 'Call direction'">
        @for (option of directions; track option.key) {
          <button type="button" [class.active]="direction() === option.key"
            [attr.aria-pressed]="direction() === option.key"
            (click)="directionChange.emit(option.key)">
            {{ zh() ? option.zh : option.en }}
          </button>
        }
      </nav>
      <div class="summary-actions">
        <span class="counts" [attr.aria-label]="zh()
          ? '录音 ' + total() + ' 条，联系人 ' + contactCount() + ' 个'
          : total() + ' recordings, ' + contactCount() + ' contacts'">
          {{ total() }} / {{ contactCount() }}
        </span>
        <button type="button" class="view-mode" (click)="toggleView.emit()"
          [attr.aria-pressed]="allRecordings()"
          [attr.aria-label]="allRecordings()
            ? (zh() ? '切换到联系人分组' : 'Group by contact')
            : (zh() ? '切换到全部录音' : 'Show all recordings')">
          {{ allRecordings() ? (zh() ? '联系人' : 'Groups') : (zh() ? '逐条' : 'All') }}
        </button>
      </div>
    </div>
    @if (hasFilter()) {
      <span class="sr-only" aria-live="polite">
        {{ zh() ? '匹配的录音' : 'Matching recordings' }} {{ matches() }}
      </span>
    }
  `,
  styles: [`
    :host {display:block;min-width:0;background:var(--ion-background-color);}
    .search-row,.filter-row {display:flex;align-items:center;gap:7px;padding:5px 10px;min-width:0;}
    .search-row {border-bottom:1px solid var(--ion-color-step-150);}
    .search-row input {min-width:0;flex:1 1 0;height:38px;border:1px solid var(--ion-color-step-200);
      border-radius:9px;padding:0 10px;background:var(--ion-color-step-50);
      color:var(--ion-text-color);font-size:14px;}
    .search-row button,.view-mode {border:1px solid var(--ion-color-step-200);border-radius:8px;
      height:38px;min-width:38px;background:var(--ion-color-step-50);color:var(--ion-text-color);
      padding:0 7px;flex:0 0 auto;}
    .search-row .refresh {font-size:22px;}
    .search-row .reset {font-size:23px;}
    .search-row button:disabled {opacity:.4;}
    .sort-select {flex:0 1 94px;min-width:65px;max-width:105px;height:38px;border-radius:8px;
      border:1px solid var(--ion-color-step-250);background:var(--ion-color-step-50);
      color:var(--ion-text-color);font-size:12px;}
    .filter-row {border-bottom:1px solid var(--ion-color-step-150);}
    .direction-row {display:flex;align-items:center;gap:5px;overflow-x:auto;min-width:0;flex:1 1 auto;
      scrollbar-width:none;}
    .direction-row::-webkit-scrollbar {display:none;}
    .direction-row button {flex:0 0 auto;min-width:47px;min-height:38px;border:0;border-radius:20px;
      padding:7px 10px;font-size:12px;background:var(--ion-color-step-100);color:var(--ion-text-color);}
    .direction-row button.active {background:var(--ion-color-primary);color:var(--ion-color-primary-contrast);font-weight:600;}
    .summary-actions {display:flex;align-items:center;gap:6px;flex:0 0 auto;}
    .counts {color:var(--ion-color-step-650);font-size:11px;white-space:nowrap;}
    .view-mode {height:38px;min-width:42px;font-size:12px;}
    .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
      clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @media (max-width:360px) {
      .search-row,.filter-row {gap:4px;padding-inline:7px;}
      .sort-select {max-width:80px;min-width:62px;}
      .counts {font-size:10px;}
      .direction-row button {min-width:43px;padding-inline:7px;}
    }
  `],
})
export class HistoryControlsComponent implements OnDestroy {
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
  private searchDebounce?: ReturnType<typeof setTimeout>;
  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.searchChange.emit(value), 230);
  }
  protected resetFilters(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.resetAll.emit();
  }
  ngOnDestroy(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }
  protected readonly sortOptions = [
    {value: SortModeEnum.Date_DESC,zh:'最新',en:'Newest'},
    {value: SortModeEnum.Date_ASC,zh:'最早',en:'Oldest'},
    {value: SortModeEnum.Duration_DESC,zh:'最长',en:'Longest'},
    {value: SortModeEnum.Duration_ASC,zh:'最短',en:'Shortest'},
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
