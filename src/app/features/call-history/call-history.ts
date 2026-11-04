import { Recording } from 'src/app/models/recording';

export type CallFilter = 'all' | 'in' | 'out' | 'voip';

/** BCR's experimental VoIP capture names (not a generic call-log source). */
const VOIP_FILE = /^bcr_\d{8}_\d{6}_(whatsapp|whatsapp-business|telegram|telegram-x|signal|viber|meet|wechat)\.wav$/i;

export function isVoipRecording(recording: Recording): boolean {
  return VOIP_FILE.test(recording.audioDisplayName || '');
}

export function filterCallRecordings(recordings: Recording[], filter: CallFilter): Recording[] {
  switch (filter) {
    case 'in': return recordings.filter(r => r.direction === 'in' && !isVoipRecording(r));
    case 'out': return recordings.filter(r => r.direction === 'out' && !isVoipRecording(r));
    case 'voip': return recordings.filter(isVoipRecording);
    default: return recordings;
  }
}

export function callSourceLabel(recording: Recording): string {
  const match = VOIP_FILE.exec(recording.audioDisplayName || '');
  if (!match) return '';
  const names: Record<string, string> = {
    whatsapp: 'WhatsApp', 'whatsapp-business': 'WhatsApp Business',
    telegram: 'Telegram', 'telegram-x': 'Telegram X',
    signal: 'Signal', viber: 'Viber', meet: 'Meet', wechat: 'WeChat',
  };
  return names[match[1].toLowerCase()] ?? 'VoIP';
}

/** Local calendar date, not a UTC date; safe across timezone boundaries. */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** CDK virtual scroll uses one 86px item for both calls and progress. */
export type CallHistoryRow =
  | { kind: 'recording'; recording: Recording; key: string }
  | { kind: 'progress'; recording: Recording; key: string };

/**
 * Insert the active recording's progress as a separate *fixed-size* virtual
 * item immediately below its contact summary. Unlike expanding an existing
 * item, this keeps all CDK virtual-scroll offsets and row heights correct.
 */
export function buildCallHistoryRows(
  summaries: Recording[],
  active: Recording | undefined,
  showProgress: boolean,
  identity: (recording: Recording) => string,
): CallHistoryRow[] {
  const rows: CallHistoryRow[] = [];
  const selectedGroup = showProgress && active ? identity(active) : undefined;
  for (const recording of summaries) {
    rows.push({ kind: 'recording', recording, key: `recording:${recording.audioUri}` });
    if (active && selectedGroup !== undefined && identity(recording) === selectedGroup) {
      rows.push({ kind: 'progress', recording: active, key: `progress:${active.audioUri}` });
    }
  }
  return rows;
}
