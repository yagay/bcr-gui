import { Recording } from 'src/app/models/recording';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';
import { RecordingGroupsService } from './recording-groups.service';
import { buildRecordingHistory, projectRecordingHistory, historyConsistency } from './recording-history.model';

function makeRecording(index: number, number: string): Recording {
  const r = new Recording();
  r.audioUri = 'content://recording/' + index;
  r.audioDisplayName = index + '.oga';
  r.opNumber = number;
  r.opName = number;
  r.date = 1000000 - index * 1000;
  return r;
}

describe('original recording history invariants', () => {
  const service = new RecordingGroupsService();
  const recordings = Array.from({ length: 29 }, (_, i) =>
    makeRecording(i, '+440000' + (i % 11).toString().padStart(2, '0'))
  );

  beforeEach(() => service.expandedGroupKey.set(undefined));

  it('never modifies or loses recordings while filtering and sorting', () => {
    const sorted = buildRecordingHistory(recordings, '', SortModeEnum.Date_DESC);
    expect(sorted).toHaveSize(29);
    expect(new Set(sorted.map(item => item.audioUri)).size).toBe(29);
    expect(recordings).toHaveSize(29);
  });

  it('keeps all 29 recordings in 11 contact groups', () => {
    const sorted = buildRecordingHistory(recordings, '', SortModeEnum.Date_DESC);
    const groups = service.buildGroups(sorted, '');
    expect(groups.size).toBe(11);
    expect(historyConsistency(sorted, groups).complete).toBeTrue();
    expect(historyConsistency(sorted, groups).groupedCount).toBe(29);
  });

  it('expands one group without hiding other contacts or changing the index', () => {
    const sorted = buildRecordingHistory(recordings, '', SortModeEnum.Date_DESC);
    const groups = service.buildGroups(sorted, '');
    const collapsed = projectRecordingHistory(groups, service, SortModeEnum.Date_DESC, '');
    expect(collapsed).toHaveSize(11);
    service.expand(sorted[0], '');
    const expanded = projectRecordingHistory(groups, service, SortModeEnum.Date_DESC, '');
    expect(expanded.length).toBeGreaterThan(11);
    expect(expanded.length).toBeLessThanOrEqual(29);
    expect(historyConsistency(sorted, groups).complete).toBeTrue();
    service.expandedGroupKey.set(undefined);
    expect(projectRecordingHistory(groups, service, SortModeEnum.Date_DESC, '')).toHaveSize(11);
  });

  it('keeps private calls separate and does not collapse unknown callers together', () => {
    const missing = [makeRecording(100, ''), makeRecording(101, '')];
    const groups = service.buildGroups(missing, '');
    expect(groups.size).toBe(2);
  });

  it('does not mix filtered-out callers into contact groups', () => {
    const filtered = buildRecordingHistory(recordings, '+44000000', SortModeEnum.Date_DESC);
    const groups = service.buildGroups(filtered, '');
    expect(groups.size).toBe(1);
    expect(historyConsistency(filtered, groups).complete).toBeTrue();
  });
});

describe('caller identity stability', () => {
  const svc = new RecordingGroupsService();
  const make = (uri: string, number: string, name: string) => {
    const rec = new Recording();
    rec.audioUri = uri; rec.opNumber = number; rec.opName = name; rec.date = 1000;
    return rec;
  };
  it('groups one phone even when the contact name changes', () => {
    const records = [make('a', '+447700900123', 'Old name'), make('b', '+447700900123', 'New name')];
    expect(svc.buildGroups(records, '').size).toBe(1);
  });
  it('does not merge callers just because they share a name', () => {
    const records = [make('a', '+447700900123', 'Reception'), make('b', '+447700900124', 'Reception')];
    expect(svc.buildGroups(records, '').size).toBe(2);
  });
  it('isolates hidden or private numbers with no stable identifier', () => {
    const records = [make('a', '', '<unknown>'), make('b', '', '<unknown>')];
    expect(svc.buildGroups(records, '').size).toBe(2);
  });
});
