import { Recording } from 'src/app/models/recording';
import { buildCallHistoryRows, callSourceLabel, filterCallRecordings, isVoipRecording, localDayKey } from './call-history';

function rec(name: string, direction: Recording['direction']): Recording {
  return Object.assign(new Recording(), { audioDisplayName: name, direction });
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
  it('uses a local calendar date key', () => {
    expect(localDayKey(new Date(2026, 10, 3, 15, 30).getTime())).toBe('2026-11-03');
    expect(localDayKey(Number.NaN)).toBe('');
  });
});

describe('fixed-size virtual progress rows', () => {
  const callerA = rec('A.wav', 'in');
  const olderCallerA = rec('A-old.wav', 'out');
  const callerB = rec('B.wav', 'in');
  const identity = (recording: Recording) => recording === callerB ? 'B' : 'A';

  it('puts progress immediately below the active caller, with no dynamic row heights', () => {
    const result = buildCallHistoryRows([callerA, callerB], olderCallerA, true, identity);
    expect(result.map(row => row.kind)).toEqual(['recording', 'progress', 'recording']);
    expect(result[1].recording).toBe(olderCallerA);
  });

  it('inserts no progress when hidden or its parent contact is filtered out', () => {
    expect(buildCallHistoryRows([callerA], olderCallerA, false, identity)).toHaveSize(1);
    expect(buildCallHistoryRows([callerB], olderCallerA, true, identity)).toHaveSize(1);
  });
});
