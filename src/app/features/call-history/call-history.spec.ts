import { Recording } from 'src/app/models/recording';
import { callSourceLabel, filterCallRecordings, isVoipRecording, localDayKey } from './call-history';

function rec(name: string, direction: Recording['direction'], folder = ''): Recording {
  return Object.assign(new Recording(), {
    audioDisplayName: name, direction, sourceFolder: folder,
  });
}

describe('call history filtering', () => {
  const ordinaryIn = rec('20261101_in_4477.m4a', 'in');
  const ordinaryOut = rec('20261101_out_4477.m4a', 'out');
  const whatsapp = rec('bcr_20261101_103040_whatsapp.wav', '');
  it('keeps all recordings by default', () => {
    expect(filterCallRecordings([ordinaryIn, ordinaryOut, whatsapp], 'all')).toHaveSize(3);
  });
  it('filters by direction without pretending VoIP has call directions', () => {
    expect(filterCallRecordings([ordinaryIn, ordinaryOut, whatsapp], 'in')).toEqual([ordinaryIn]);
    expect(filterCallRecordings([ordinaryIn, ordinaryOut, whatsapp], 'out')).toEqual([ordinaryOut]);
  });
  it('only tags a known VoIP filename, not every WAV file', () => {
    expect(isVoipRecording(whatsapp)).toBeTrue();
    expect(isVoipRecording(rec('recording.wav', ''))).toBeFalse();
    expect(callSourceLabel(whatsapp)).toBe('WhatsApp');
    expect(filterCallRecordings([ordinaryIn, whatsapp], 'voip')).toEqual([whatsapp]);
  });
  it('recognizes nested VoIP histories, not just one .wav naming pattern', () => {
    const nested = rec('call.oga','', 'VoIP/WhatsApp');
    const oldOpus = rec('bcr_20261101_103040_telegram.opus','');
    expect(isVoipRecording(nested)).toBeTrue();
    expect(isVoipRecording(oldOpus)).toBeTrue();
    expect(callSourceLabel(nested)).toBe('WhatsApp');
    expect(callSourceLabel(oldOpus)).toBe('Telegram');
    expect(filterCallRecordings([nested, oldOpus], 'voip')).toHaveSize(2);
    expect(filterCallRecordings([rec('regular.wav','in'), nested], 'in')).toHaveSize(1);
  });
  it('uses a local calendar date key', () => {
    expect(localDayKey(new Date(2026, 10, 3, 15, 30).getTime())).toBe('2026-11-03');
    expect(localDayKey(Number.NaN)).toBe('');
  });
});
