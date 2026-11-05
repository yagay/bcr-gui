/**
 * Document providers frequently report generic/incorrect MIME values.
 * Filename extensions are sufficient to identify known audio recordings.
 */
const AUDIO_EXT = /\.(?:flac|m4a|mp4|mp3|ogg|oga|opus|wav|wave|amr|awb|3gp|3gpp|3ga|aac|webm)$/i;

export function isRecordingAudioFile(
  displayName: string, mimeType: string, supportedTypes: readonly string[],
): boolean {
  const mime = mimeType.toLowerCase().trim();
  return AUDIO_EXT.test(displayName) ||
    mime.startsWith('audio/') ||
    supportedTypes.some(type => type.toLowerCase() === mime);
}

/** Do not discard an existing history record when any subfolder failed to scan. */
export function shouldPruneCachedAudio(
  key: string, scannedAudio: Readonly<Record<string, unknown>>, scanIncomplete: boolean,
): boolean {
  return !scanIncomplete && !Object.prototype.hasOwnProperty.call(scannedAudio, key);
}
