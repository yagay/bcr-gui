import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDisplayRows, actionRecords, selectionState } from '../../src/app/features/recording-groups/history-display-rows.ts';
import type { Recording } from '../../src/app/models/recording';

function call(index: number): Recording {
  return { audioUri: 'content://test/' + index, opName: 'Contact', opNumber: '100' } as Recording;
}
test('29 historic recordings remain 29 entries, one selected player adds only one extra row', () => {
  const records = Array.from({ length: 29 }, (_, i) => call(i));
  assert.equal(buildDisplayRows(records).length, 29);
  const view = buildDisplayRows(records, records[12].audioUri);
  assert.equal(view.length, 30);
  assert.equal(view[13].kind, 'player');
  assert.equal(view[13].key, 'player:' + records[12].audioUri);
  assert.equal(view.filter(x => x.kind === 'recording').length, 29);
});
test('a recording hidden by filtering does not leave an orphan player', () => {
  const a = call(0), b = call(1);
  assert.deepEqual(buildDisplayRows([b], a.audioUri).map(x => x.key), [b.audioUri]);
});
test('contact headers select entire group but children select themselves', () => {
  const a = call(0), b = call(1), c = call(2), group = [a,b,c];
  assert.deepEqual(actionRecords(a, true, true, group), group);
  assert.deepEqual(actionRecords(b, false, true, group), [b]);
  assert.deepEqual(actionRecords(a, true, false, group), [a]);
});
test('selection state distinguishes all, partial and none without mutating files', () => {
  const a=call(0),b=call(1),members=[a,b];
  assert.equal(selectionState(members,new Set()),'none');
  assert.equal(selectionState(members,new Set([a.audioUri])),'partial');
  assert.equal(selectionState(members,new Set([a.audioUri,b.audioUri])),'all');
  assert.equal(a.selected,undefined);
});
