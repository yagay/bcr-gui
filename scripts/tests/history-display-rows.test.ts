import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDisplayRows, actionRecords, selectionState, setGroupSelection,
  invertRecordingSelection, inlineRowOnScreen, callHistoryDateLabel,
} from '../../src/app/features/recording-groups/history-display-rows.ts';
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

test('inline audio row is shown only when fully visible, not merely indexed', () => {
  const records = Array.from({ length: 29 }, (_, i) => call(i));
  const active = records[12].audioUri;
  const rows = buildDisplayRows(records, active);
  const playerIndex = 13;
  assert.equal(inlineRowOnScreen(rows, active, 0, 5 * 78, 78), false);
  assert.equal(inlineRowOnScreen(rows, active, playerIndex * 78 - 100, 300, 78), true);
  assert.equal(inlineRowOnScreen(rows, active, playerIndex * 78 + 1, 300, 78), false);
  assert.equal(inlineRowOnScreen(rows, active, playerIndex * 78 - 10, 70, 78), false);
  assert.equal(inlineRowOnScreen(rows, active, 0, 0, 78), false);
  assert.equal(inlineRowOnScreen(rows, undefined, 0, 500, 78), false);
});
test('collapsing the contact moves controls to the dock without losing source audio', () => {
  const members = [call(1), call(2), call(3)];
  const groupHeader = members[0];
  const collapsed = buildDisplayRows([groupHeader], members[2].audioUri);
  assert.equal(collapsed.length, 1);
  assert.equal(inlineRowOnScreen(collapsed, members[2].audioUri, 0, 400, 78), false);
  const expanded = buildDisplayRows(members, members[2].audioUri);
  assert.equal(inlineRowOnScreen(expanded, members[2].audioUri, 0, 400, 78), true);
});
test('group tri-state and invert use recording URIs, not old object flags', () => {
  const group = [call(1),call(2),call(3)];
  let selected: ReadonlySet<string> = setGroupSelection(new Set(), group);
  assert.equal(selectionState(group, selected), 'all');
  selected = setGroupSelection(selected, [group[1]], false);
  assert.equal(selectionState(group, selected), 'partial');
  selected = invertRecordingSelection(selected, group);
  assert.equal(selectionState(group, selected), 'partial');
  assert.equal(selected.has(group[1].audioUri), true);
  assert.equal(selected.has(group[0].audioUri), false);
  selected = setGroupSelection(selected, group);
  assert.equal(selectionState(group, selected), 'all');
  selected = setGroupSelection(selected, group);
  assert.equal(selectionState(group, selected), 'none');
  // The same URI remains selected after a new SAF Recording object is built.
  selected = setGroupSelection(new Set(), [group[0]]);
  assert.equal(selectionState([call(1)], selected), 'all');
});
test('local today/yesterday labels respect calendar boundaries', () => {
  const now = new Date(2026, 10, 4, 18, 0);
  const today = new Date(2026, 10, 4, 8, 30).getTime();
  const yesterday = new Date(2026, 10, 3, 23, 55).getTime();
  const older = new Date(2026, 10, 2, 14, 20).getTime();
  assert.match(callHistoryDateLabel(today, 'zh-CN', false, now), /^今天 /);
  assert.match(callHistoryDateLabel(yesterday, 'zh-CN', false, now), /^昨天 /);
  assert.match(callHistoryDateLabel(today, 'en-GB', false, now), /^Today /);
  assert.match(callHistoryDateLabel(yesterday, 'en-GB', false, now), /^Yesterday /);
  assert.doesNotMatch(callHistoryDateLabel(older, 'en-GB', false, now), /Today|Yesterday/);
  assert.equal(callHistoryDateLabel(0, 'en-GB', false, now), '');
});
