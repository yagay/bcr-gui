import { Recording } from 'src/app/models/recording';
import { filterList } from 'src/app/utils/filterList';
import { SortModeEnum, sortRecordings } from 'src/app/utils/recordings-sorter';
import { RecordingGroupsService } from './recording-groups.service';

export type HistoryFilter = 'all' | 'in' | 'out' | 'voip';

/** Only recordings positively identified as VoIP should enter this filter. */
export function isVoipRecording(item: Recording): boolean {
  // BCR's VoIP folder is authoritative; subfolders preserve their identity.
  const folder = item.sourceFolder || '';
  const knownApp = /^(?:voip|whatsapp(?:[- ]business)?|telegram(?:[- ]x)?|signal|viber|wechat|skype|discord|meet)$/i;
  if (folder.split(/[\\/]/).some(segment => knownApp.test(segment))) return true;

  // Old imports sometimes lack a sourceFolder. Match explicit app suffixes
  // rather than treating every WAV file (or contact with an app name) as VoIP.
  const filename = item.audioDisplayName || '';
  return /(?:^|[_ .-])(?:whatsapp(?:[- ]business)?|telegram(?:[- ]x)?|signal|viber|wechat|skype|discord|meet)(?:[_ .-]|$)/i
    .test(filename.replace(/\.(?:wav|oga|ogg|m4a|aac|mp3|opus|flac)$/i, '')) &&
    /\.(?:wav|oga|ogg|m4a|aac|mp3|opus|flac)$/i.test(filename);
}

export function filterRecordingDirection(records: Recording[], filter: HistoryFilter): Recording[] {
  if (filter === 'all') return records;
  if (filter === 'voip') return records.filter(isVoipRecording);
  return records.filter(item => !isVoipRecording(item) && item.direction === filter);
}


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

