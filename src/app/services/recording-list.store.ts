import { computed, inject, Injectable, signal } from '@angular/core';
import { Recording } from '../models/recording';
import { filterList } from '../utils/filterList';
import { sortRecordings } from '../utils/recordings-sorter';
import { RecordingsService } from './recordings.service';
import { SettingsService } from './settings.service';

export type DirectionFilter = 'all' | 'in' | 'out' | 'unknown';

/**
 * UI-only list state. Never mutate Recording.selected: persisted recordings,
 * playback and batch selection are three different concepts.
 */
@Injectable()
export class RecordingListStore {
  private readonly recordings = inject(RecordingsService);
  private readonly settings = inject(SettingsService);

  readonly searchValue = signal('');
  readonly directionFilter = signal<DirectionFilter>('all');
  readonly isMultiselect = signal(false);
  readonly selectedUris = signal<ReadonlySet<string>>(new Set());

  readonly items = computed<Recording[]>(() => {
    const filtered = filterList(
      this.recordings.recordings(),
      this.searchValue(),
      r => `${r.opName} ${r.opNumber}`
    ).filter(r => {
      const direction = this.directionFilter();
      if (direction === 'all') return true;
      if (direction === 'unknown') return !['in', 'out'].includes(r.direction ?? '');
      return r.direction === direction;
    });
    return sortRecordings(filtered, this.settings.recordingsSortMode);
  });

  readonly selectedCount = computed(() => this.items().filter(r => this.selectedUris().has(r.audioUri)).length);

  isSelected(item: Recording) {
    return this.selectedUris().has(item.audioUri);
  }

  toggle(item: Recording) {
    const next = new Set(this.selectedUris());
    if (next.has(item.audioUri)) next.delete(item.audioUri);
    else next.add(item.audioUri);
    this.selectedUris.set(next);
    if (!this.selectedCount()) this.isMultiselect.set(false);
  }

  startMultiselection(item?: Recording) {
    if (!this.isMultiselect()) {
      this.selectedUris.set(new Set());
      this.isMultiselect.set(true);
    }
    if (item && !this.isSelected(item)) {
      const next = new Set(this.selectedUris());
      next.add(item.audioUri);
      this.selectedUris.set(next);
    }
  }

  selectAll() {
    this.isMultiselect.set(true);
    this.selectedUris.set(new Set(this.items().map(r => r.audioUri)));
  }

  getSelectedItems(): Recording[] {
    return this.items().filter(r => this.isSelected(r));
  }

  clearSelection() {
    this.selectedUris.set(new Set());
    this.isMultiselect.set(false);
  }

  clearFilter() {
    this.searchValue.set('');
    this.directionFilter.set('all');
  }
}
