import { Recording } from 'src/app/models/recording';
import { SortModeEnum, sortRecordings } from 'src/app/utils/recordings-sorter';

/**
 * One source of truth for recording-list presentation.
 *
 * The complete sorted recording list is never mutated by contact grouping.
 * Group mode only changes which summaries are visible and which recordings
 * an action targets. Per-record mode always targets exactly one recording.
 */
export function visibleHistoryRecordings(
  sortedRecordings: Recording[],
  groups: Map<string, Recording[]>,
  showEachRecording: boolean,
  sortMode: SortModeEnum,
): Recording[] {
  if (showEachRecording) return sortedRecordings;
  return sortRecordings(
    Array.from(groups.values(), recordings => recordings[0]),
    sortMode,
  );
}

export function historyActionRecords(
  recording: Recording,
  groups: Map<string, Recording[]>,
  groupKey: string,
  showEachRecording: boolean,
): Recording[] {
  if (showEachRecording) return [recording];
  return groups.get(groupKey) ?? [recording];
}
