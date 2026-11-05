import { Recording } from 'src/app/models/recording';

export type CallFilter = 'all' | 'in' | 'out' | 'voip';

/** Old BCR VoIP capture suffixes, with all supported audio codecs. */
const VOIP_FILE = /^bcr_\d{8}_\d{6}_(whatsapp|whatsapp-business|telegram|telegram-x|signal|viber|meet|wechat)\.(?:wav|ogg|oga|opus|m4a|mp4|mp3|aac|flac|webm|amr|3gp)$/i;

export function isVoipRecording(recording: Recording): boolean {
  // Indexer preserves the source directory for new and cached recordings.
  return VOIP_FILE.test(recording.audioDisplayName || '') ||
    /(?:^|\/)VoIP(?:\/|$)/i.test(recording.sourceFolder || '');
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
  const names: Record<string, string> = {
    whatsapp: 'WhatsApp', 'whatsapp-business': 'WhatsApp Business',
    telegram: 'Telegram', 'telegram-x': 'Telegram X',
    signal: 'Signal', viber: 'Viber', meet: 'Meet', wechat: 'WeChat',
  };
  if (match) return names[match[1].toLowerCase()] ?? 'VoIP';
  if (/(?:^|\/)VoIP(?:\/|$)/i.test(recording.sourceFolder || '')) {
    const lastSegment = (recording.sourceFolder || '').split('/').filter(Boolean).pop()?.toLowerCase();
    return lastSegment && lastSegment !== 'voip'
      ? (names[lastSegment] ?? 'VoIP') : 'VoIP';
  }
  return '';
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
