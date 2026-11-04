import { Recording } from 'src/app/models/recording';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';
import { historyActionRecords, visibleHistoryRecordings } from './history-view-model';

function recording(name: string, date: number): Recording {
  return Object.assign(new Recording(), {
    audioDisplayName: name,
    audioUri: 'content://test/' + name,
    date,
  });
}

describe('history view model', () => {
  const aLatest = recording('a-latest.oga', 300);
  const aOlder = recording('a-older.oga', 100);
  const b = recording('b.oga', 200);
  const sorted = [aLatest, b, aOlder];
  const groups = new Map([
    ['a', [aLatest, aOlder]],
    ['b', [b]],
  ]);

  it('always preserves all files in individual recording mode', () => {
    expect(visibleHistoryRecordings(sorted, groups, true, SortModeEnum.Date_DESC)).toEqual(sorted);
    expect(historyActionRecords(aOlder, groups, 'a', true)).toEqual([aOlder]);
  });

  it('shows one summary and targets the whole contact only in group mode', () => {
    expect(visibleHistoryRecordings(sorted, groups, false, SortModeEnum.Date_DESC)).toEqual([aLatest, b]);
    expect(historyActionRecords(aOlder, groups, 'a', false)).toEqual([aLatest, aOlder]);
  });

  it('keeps an unknown contact isolated from unrelated recordings', () => {
    expect(historyActionRecords(b, groups, 'missing', false)).toEqual([b]);
  });

  it('never removes or reorders the original full list', () => {
    visibleHistoryRecordings(sorted, groups, false, SortModeEnum.Date_ASC);
    expect(sorted).toEqual([aLatest, b, aOlder]);
    expect(groups.get('a')).toEqual([aLatest, aOlder]);
  });
});
