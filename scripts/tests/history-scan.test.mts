import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRecordingAudioFile, shouldPruneCachedAudio } from '../../src/app/services/recording-scan-policy.ts';

const supported = ['audio/mp4','audio/x-wav','audio/ogg','audio/flac'];

test('accepts BCR recordings even when SAF reports application/octet-stream', () => {
  for (const file of ['call.m4a','call.wav','call.OGA','call.opus','call.amr','call.3gp',
    'call.webm','call.flac','call.mp3']) {
    assert.equal(isRecordingAudioFile(file,'application/octet-stream',supported),true,file);
  }
});
test('accepts all audio MIME from document providers, including novel codecs', () => {
  assert.equal(isRecordingAudioFile('audio-no-ext','audio/unknown',supported),true);
  assert.equal(isRecordingAudioFile('audio','AUDIO/MP4',supported),true);
  assert.equal(isRecordingAudioFile('unknown.bin','application/octet-stream',supported),false);
  assert.equal(isRecordingAudioFile('call.json','application/json',supported),false);
});
test('preserves cached history when a nested directory fails or depth limit is hit', () => {
  const scanned = {'VoIP/recording.wav':{}};
  assert.equal(shouldPruneCachedAudio('2025/archive-old.m4a',scanned,true),false);
  assert.equal(shouldPruneCachedAudio('VoIP/recording.wav',scanned,true),false);
  assert.equal(shouldPruneCachedAudio('2025/archive-old.m4a',scanned,false),true);
  assert.equal(shouldPruneCachedAudio('VoIP/recording.wav',scanned,false),false);
});
