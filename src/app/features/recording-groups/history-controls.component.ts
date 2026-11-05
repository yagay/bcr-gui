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
        <span class="counts" [attr.aria-label]="i18n.get('HISTORY_RECORDINGS') + ' ' + total()
          + ', ' + i18n.get('HISTORY_CONTACTS') + ' ' + contactCount()">
          {{ total() }} / {{ contactCount() }}
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
        <button type="button" class="refresh" [disabled]="refreshing()" (click)="refresh.emit()"
          [attr.aria-label]="i18n.get('HISTORY_REFRESH')">
          {{ refreshing() ? '◌' : '↻' }}
        </button>
        @if (search() || direction() !== 'all') {
          <button type="button" class="reset" (click)="resetFilters()"
            [attr.aria-label]="i18n.get('HISTORY_RESET_FILTERS')">×</button>
        }
      </div>
    </div>
    @if (hasFilter()) {
      <span class="sr-only" aria-live="polite">
        {{ i18n.get('HISTORY_MATCHES') }} {{ matches() }}
      </span>
    }
  `,
  styles: [`
    :host {display:block;min-width:0;background:var(--ion-background-color);}
    .search-row,.filter-row {display:flex;align-items:center;gap:6px;padding:5px 8px;min-width:0;}
    .search-row {border-bottom:1px solid var(--ion-color-step-150);}
    .search-row input {min-width:0;flex:1 1 0;height:40px;border:1px solid var(--ion-color-step-200);
      border-radius:9px;padding:0 10px;color:var(--ion-text-color);background:var(--ion-color-step-50);font-size:14px;}
    .filter-row {border-bottom:1px solid var(--ion-color-step-150);}
    .direction-row {display:flex;gap:4px;align-items:center;overflow-x:auto;flex:1 1 auto;
      min-width:0;scrollbar-width:none;}
    .direction-row::-webkit-scrollbar {display:none;}
    .direction-row button {flex:0 0 auto;border:0;border-radius:20px;min-height:40px;
      padding:7px 9px;font-size:12px;color:var(--ion-text-color);background:var(--ion-color-step-100);}
    .direction-row button.active {background:var(--ion-color-primary);color:var(--ion-color-primary-contrast);
      font-weight:600;}
    .summary-actions {display:flex;gap:4px;align-items:center;flex:0 0 auto;min-width:0;}
    .counts {font-size:11px;color:var(--ion-color-step-650);white-space:nowrap;}
    .sort-select {height:40px;min-width:0;max-width:90px;width:76px;border:1px solid var(--ion-color-step-200);
      border-radius:8px;background:var(--ion-color-step-50);color:var(--ion-text-color);font-size:12px;}
    .summary-actions button,.search-row button {min-width:36px;height:40px;padding:0 6px;
      border:1px solid var(--ion-color-step-200);border-radius:8px;background:var(--ion-color-step-50);
      color:var(--ion-text-color);font-size:12px;}
    .summary-actions button.refresh {font-size:20px;}
    .summary-actions button.reset,.search-row button.reset {font-size:22px;}
    .summary-actions button:disabled {opacity:.4;}
    .summary-actions .view-mode {max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
      clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @media(max-width:400px) {
      .counts {display:none;}
      .sort-select {width:70px;}
      .direction-row button {padding-inline:7px;}
    }
  `],
})
export class HistoryControlsComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('historySearch');
  protected readonly searchVisible = signal(false);
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
