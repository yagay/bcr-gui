import type { Recording } from '../../models/recording';

/** Actual physical height of each virtual item; no CSS overlap or guessed fixed itemSize. */
export const HISTORY_ROW_HEIGHT = { contact: 80, child: 48, detail: 170, player: 90 } as const;

export type HistoryDisplayRow =
  | { kind: 'recording'; recording: Recording; key: string; height: number; isChild: boolean }
  | { kind: 'detail'; recording: Recording; key: string; height: number }
  | { kind: 'player'; recording: Recording; key: string; height: number };

export interface HistoryDisplayOptions {
  isChild?: (recording: Recording) => boolean;
  showDetails?: boolean;
  detailHeight?: number;
  playerHeight?: number;
}

/** Single projection for both the visible UI and the virtualization geometry. */
export function buildDisplayRows(
  recordings: Recording[],
  activeUri?: string,
  options: HistoryDisplayOptions = {},
): HistoryDisplayRow[] {
  const rows: HistoryDisplayRow[] = [];
  for (const recording of recordings) {
    const isChild = options.isChild?.(recording) ?? false;
    rows.push({
      kind: 'recording', recording, key: recording.audioUri, isChild,
      height: options.isChild ? (isChild ? HISTORY_ROW_HEIGHT.child : HISTORY_ROW_HEIGHT.contact) : 78,
    });
    if (activeUri === recording.audioUri) {
      if (options.showDetails) {
        rows.push({
          kind: 'detail', recording, key: 'detail:' + recording.audioUri,
          height: options.detailHeight ?? HISTORY_ROW_HEIGHT.detail,
        });
      }
      rows.push({
        kind: 'player', recording, key: 'player:' + recording.audioUri,
        height: options.playerHeight ?? (options.isChild ? HISTORY_ROW_HEIGHT.player : 78),
      });
    }
  }
  return rows;
}

/** Prefix sum helpers used by scrolling, screen intersection and tests. */
export function historyRowOffsets(rows: readonly HistoryDisplayRow[]): number[] {
  const offsets = [0];
  for (const row of rows) offsets.push(offsets[offsets.length - 1] + row.height);
  return offsets;
}

export function historyIndexAtOffset(offsets: readonly number[], pixel: number): number {
  if (offsets.length < 2) return 0;
  let low = 0, high = offsets.length - 2;
  const target = Math.max(0, pixel);
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle + 1] <= target) low = middle + 1;
    else if (offsets[middle] > target) high = middle - 1;
    else return middle;
  }
  return Math.min(low, offsets.length - 2);
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

/** A full player row must fit in the viewport; off-screen/partial rows use the dock. */
export function inlineRowOnScreen(
  rows: readonly HistoryDisplayRow[],
  activeUri: string | undefined,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
): boolean {
  if (!activeUri || viewportHeight <= 0 || rowHeight <= 0) return false;
  const index = rows.findIndex(row => row.key === 'player:' + activeUri);
  if (index < 0) return false;
  const offsets = historyRowOffsets(rows);
  const firstPixel = offsets[index];
  const lastPixel = offsets[index + 1];
  return firstPixel >= scrollTop + 1 && lastPixel <= scrollTop + viewportHeight - 1;
}

/** URI-based multi-select survives CDK view recycling and refreshed objects. */
export function setGroupSelection(
  oldSelection: ReadonlySet<string>,
  members: readonly Recording[],
  select?: boolean,
): ReadonlySet<string> {
  const next = new Set(oldSelection);
  const shouldSelect = select ?? !members.every(item => next.has(item.audioUri));
  for (const item of members) {
    if (shouldSelect) next.add(item.audioUri);
    else next.delete(item.audioUri);
  }
  return next;
}

export function invertRecordingSelection(
  oldSelection: ReadonlySet<string>,
  eligible: readonly Recording[],
): ReadonlySet<string> {
  const next = new Set(oldSelection);
  for (const item of eligible) {
    if (next.has(item.audioUri)) next.delete(item.audioUri);
    else next.add(item.audioUri);
  }
  return next;
}

/** Local-date relative labels; avoids comparing UTC dates with local call dates. */
export function callHistoryDateLabel(
  timestamp: number,
  locale: 'zh-CN' | 'en-GB',
  hour12: boolean,
  now = new Date(),
): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', hour12,
  }).format(date);
  if (timestamp >= startToday && timestamp <= now.getTime()) return (locale === 'zh-CN' ? '今天 ' : 'Today ') + time;
  if (timestamp >= startYesterday && timestamp < startToday) return (locale === 'zh-CN' ? '昨天 ' : 'Yesterday ') + time;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12,
  }).format(date);
}
