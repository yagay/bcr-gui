import { ChangeDetectionStrategy, Component, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { I18nKey, I18nService } from 'src/app/services/i18n.service';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';

export type HistoryDirection = 'all' | 'in' | 'out' | 'voip';

/** Compact, reusable 2-row control bar. Inputs are state, events request changes. */
@Component({
  selector: 'app-history-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (searchVisible()) {
      <div class="search-row">
        <input #historySearch type="search" [value]="search()"
          (input)="onSearchInput($event)"
          [placeholder]="i18n.get('HISTORY_SEARCH_HINT')"
          [attr.aria-label]="i18n.get('LBL_SEARCH')" />
        <button type="button" class="reset" (click)="clearSearch()"
          [attr.aria-label]="i18n.get('HISTORY_RESET_FILTERS')">×</button>
      </div>
    }
    @if (filtersVisible()) {
    <div class="filter-row">
      <nav class="direction-row" [attr.aria-label]="i18n.get('HISTORY_FILTER_DIRECTION')">
        @for (option of directions; track option.key) {
          <button type="button" [class.active]="direction() === option.key"
            [attr.aria-pressed]="direction() === option.key"
            (click)="directionChange.emit(option.key)">
            {{ i18n.get(option.label) }}
          </button>
        }
      </nav>
      <div class="summary-actions">
        <button type="button" class="refresh" [disabled]="refreshing()"
          (click)="refresh.emit()" [attr.aria-label]="i18n.get('HISTORY_REFRESH')">
          {{ refreshing() ? '◌' : '↻' }}
        </button>
        <button type="button" class="more" (click)="toggleOptions()"
          [attr.aria-expanded]="showOptions()"
          [attr.aria-label]="i18n.get('MAINMENU_MENU_TITLE')">
          {{ showOptions() ? '⌃' : '⋯' }}
        </button>
      </div>
    </div>
    @if (showOptions()) {
      <div class="options-row">
        <span class="counts" [attr.aria-label]="i18n.get('HISTORY_RECORDINGS') + ' ' + total()
          + ', ' + i18n.get('HISTORY_CONTACTS') + ' ' + contactCount()">
          {{ i18n.get('HISTORY_RECORDINGS') }} {{ total() }} ·
          {{ i18n.get('HISTORY_CONTACTS') }} {{ contactCount() }}
        </span>
        <select class="sort-select" [value]="sortMode()" (change)="updateSort($event)"
          [attr.aria-label]="i18n.get('HISTORY_SORT')">
          @for (option of sortOptions; track option.value) {
            <option [value]="option.value">{{ i18n.get(option.label) }}</option>
          }
        </select>
        <button type="button" class="view-mode" (click)="toggleView.emit()"
          [attr.aria-pressed]="allRecordings()"
          [attr.aria-label]="allRecordings()
            ? i18n.get('HISTORY_BY_CONTACT') : i18n.get('HISTORY_EACH')">
          {{ allRecordings() ? i18n.get('HISTORY_BY_CONTACT') : i18n.get('HISTORY_EACH') }}
        </button>
        @if (search() || direction() !== 'all') {
          <button type="button" class="reset" (click)="resetFilters()"
            [attr.aria-label]="i18n.get('HISTORY_RESET_FILTERS')">×</button>
        }
      </div>
    }
    }
    @if (hasFilter()) {
      <span class="sr-only" aria-live="polite">
        {{ i18n.get('HISTORY_MATCHES') }} {{ matches() }}
      </span>
    }
  `,
  styles: [`
    :host {display:block;min-width:0;background:var(--ion-background-color);}
    .search-row,.filter-row,.options-row {display:flex;align-items:center;gap:6px;
      padding:5px 10px;min-width:0;border-bottom:1px solid var(--ion-color-step-150);}
    .search-row input {min-width:0;flex:1 1 0;height:40px;border:1px solid var(--ion-color-step-200);
      border-radius:9px;padding:0 10px;color:var(--ion-text-color);
      background:var(--ion-color-step-50);font-size:14px;}
    .direction-row {display:flex;gap:4px;align-items:center;overflow-x:auto;flex:1 1 auto;
      min-width:0;scrollbar-width:none;}
    .direction-row::-webkit-scrollbar {display:none;}
    .direction-row button {flex:0 0 auto;border:0;border-radius:20px;min-height:38px;
      padding:6px 10px;font-size:12px;color:var(--ion-text-color);background:var(--ion-color-step-100);}
    .direction-row button.active {background:var(--ion-color-primary);
      color:var(--ion-color-primary-contrast);font-weight:600;}
    .summary-actions {display:flex;gap:4px;align-items:center;flex:0 0 auto;}
    .options-row {background:var(--ion-color-step-50);min-height:40px;flex-wrap:wrap;justify-content:flex-end;}
    .counts {font-size:11px;color:var(--ion-color-step-650);white-space:nowrap;
      margin-right:auto;}
    .sort-select {height:38px;min-width:85px;max-width:120px;border:1px solid var(--ion-color-step-200);
      border-radius:8px;background:var(--ion-background-color);color:var(--ion-text-color);font-size:12px;}
    .summary-actions button,.options-row button,.search-row button {min-width:38px;min-height:40px;
      padding:0 8px;border:1px solid var(--ion-color-step-200);border-radius:8px;
      background:var(--ion-background-color);color:var(--ion-text-color);font-size:13px;}
    .summary-actions .refresh {font-size:21px;}
    .summary-actions .more {font-size:23px;}
    .summary-actions button:disabled {opacity:.4;}
    .options-row .view-mode {max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
      clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @media(max-width:360px) {
      .search-row,.filter-row,.options-row {padding-inline:7px;gap:4px;}
      .direction-row button {padding-inline:7px;}
      .counts {flex:1 0 100%;margin-right:0;}
    }
  `],
})
export class HistoryControlsComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('historySearch');
  protected readonly searchVisible = signal(false);
  protected readonly filtersVisible = signal(false);
  public toggleFilters(): void {
    this.filtersVisible.update(open => !open);
    if (!this.filtersVisible()) this.showOptions.set(false);
  }
  protected readonly showOptions = signal(false);
  protected toggleOptions(): void { this.showOptions.update(open => !open); }
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
  public toggleSearch(): void {
    this.searchVisible.update(open => !open);
    if (this.searchVisible()) setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
  }
  protected clearSearch(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchChange.emit('');
    this.searchVisible.set(false);
  }
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
  protected readonly sortOptions: {value: SortModeEnum; label: I18nKey}[] = [
    {value: SortModeEnum.Date_DESC, label: 'SETTINGS_RECORDINGS_SORT_DATE_DESC'},
    {value: SortModeEnum.Date_ASC, label: 'SETTINGS_RECORDINGS_SORT_DATE_ASC'},
    {value: SortModeEnum.Duration_DESC, label: 'SETTINGS_RECORDINGS_SORT_DURATION_DESC'},
    {value: SortModeEnum.Duration_ASC, label: 'SETTINGS_RECORDINGS_SORT_DURATION_ASC'},
  ];
  protected updateSort(event: Event): void {
    const selected = Number((event.target as HTMLSelectElement).value);
    if (this.sortOptions.some(option => option.value === selected)) {
      this.sortChange.emit(selected as SortModeEnum);
    }
  }
  protected readonly directions: {key: HistoryDirection;label: I18nKey}[] = [
    {key:'all',label:'HISTORY_ALL'},
    {key:'in',label:'HISTORY_INCOMING'},
    {key:'out',label:'HISTORY_OUTGOING'},
    {key:'voip',label:'HISTORY_VOIP'},
  ];
}
