import type { Recording } from '../../models/recording';

/** Recognize explicit VoIP provenance without hiding conventional call recordings. */
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

