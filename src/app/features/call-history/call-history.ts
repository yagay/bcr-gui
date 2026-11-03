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
