import { Recording } from 'src/app/models/recording';
import { filterList } from 'src/app/utils/filterList';
import { SortModeEnum, sortRecordings } from 'src/app/utils/recordings-sorter';
import { RecordingGroupsService } from './recording-groups.service';

/** Pure source projection. The recording store remains the only data source. */
export function buildRecordingHistory(
  recordings: Recording[],
  search: string,
  sortMode: SortModeEnum,
): Recording[] {
  return sortRecordings(filterList(
    recordings,
    search,
    item => `${item.opName} ${item.opNumber}`,
  ), sortMode);
}

/**
 * Delegate to the original, working group expansion rules.
 * Do not rebuild contact lists or maintain a second indexed cache in the UI.
 */
export function projectRecordingHistory(
  groups: Map<string, Recording[]>,
  service: RecordingGroupsService,
  sortMode: SortModeEnum,
  defaultCountryPrefix: string,
): Recording[] {
  return service.flattenGroups(groups, sortMode, defaultCountryPrefix);
}

/** Used by regression tests and optional diagnostics; never hides a record. */
export function historyConsistency(
  filteredRecords: Recording[],
  groups: Map<string, Recording[]>,
): { sourceCount: number; groupedCount: number; complete: boolean } {
  const grouped = Array.from(groups.values()).flat();
  const sourceUris = new Set(filteredRecords.map(record => record.audioUri));
  const groupedUris = new Set(grouped.map(record => record.audioUri));
  return {
    sourceCount: filteredRecords.length,
    groupedCount: grouped.length,
    complete: sourceUris.size === groupedUris.size &&
      filteredRecords.length === grouped.length &&
      filteredRecords.every(record => grouped.includes(record)),
  };
}
