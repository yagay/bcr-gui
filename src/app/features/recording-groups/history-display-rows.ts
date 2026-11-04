import type { Recording } from '../../models/recording';

/** One CDK index = one fixed-height row. Playback never changes recording-row geometry. */
export type HistoryDisplayRow =
  | { kind: 'recording'; recording: Recording; key: string }
  | { kind: 'player'; recording: Recording; key: string };

export function buildDisplayRows(recordings: Recording[], activeUri?: string): HistoryDisplayRow[] {
  const rows: HistoryDisplayRow[] = [];
  for (const recording of recordings) {
    rows.push({ kind: 'recording', recording, key: recording.audioUri });
    if (activeUri === recording.audioUri) {
      rows.push({ kind: 'player', recording, key: 'player:' + recording.audioUri });
    }
  }
  return rows;
}

/** A contact header selects a group; a child row always selects only itself. */
export function actionRecords(
  recording: Recording,
  isHeader: boolean,
  grouped: boolean,
  group: readonly Recording[],
): Recording[] {
  return grouped && isHeader ? [...group] : [recording];
}

/** Main selection is recorded by URI so SAF refreshed objects cannot be mixed with stale ones. */
export function selectionState(
  members: readonly Recording[],
  selectedUris: ReadonlySet<string>,
): 'none' | 'partial' | 'all' {
  if (!members.length) return 'none';
  const count = members.filter(item => selectedUris.has(item.audioUri)).length;
  return !count ? 'none' : count === members.length ? 'all' : 'partial';
}
