import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDisplayRows, actionRecords, selectionState, setGroupSelection,
  invertRecordingSelection, inlineRowOnScreen, callHistoryDateLabel,
  HISTORY_ROW_HEIGHT, historyRowOffsets, historyIndexAtOffset,
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

test('VoIP detection recognizes BCR folder provenance and supported audio formats', async () => {
  const { isVoipRecording } = await import('../../src/app/features/recording-groups/history-voip.ts');
  const make = (folder: string, file: string) =>
    ({ sourceFolder: folder, audioDisplayName: file } as Recording);
  assert.equal(isVoipRecording(make('VoIP', 'call.oga')), true);
  assert.equal(isVoipRecording(make('VoIP/WhatsApp', 'call.opus')), true);
  assert.equal(isVoipRecording(make('recordings/Telegram', 'call.m4a')), true);
  assert.equal(isVoipRecording(make('', '20261104_120000_whatsapp.oga')), true);
  assert.equal(isVoipRecording(make('', '20261104_120000_telegram.mp3')), true);
  assert.equal(isVoipRecording(make('', '20261104_120000_signal.wav')), true);
  assert.equal(isVoipRecording(make('', 'call.wav')), false);
  assert.equal(isVoipRecording(make('', 'not-audio_whatsapp.txt')), false);
});

test('variable-height history is pixel-accurate and never overlays a neighbouring call', () => {
  const records = [call(0), call(1), call(2)];
  const display = buildDisplayRows(records, records[1].audioUri, {
    isChild: record => record === records[1],
    showDetails: true,
  });
  assert.deepEqual(display.map(x => x.kind), [
    'recording','recording','detail','player','recording',
  ]);
  assert.deepEqual(display.map(x => x.height), [
    HISTORY_ROW_HEIGHT.contact,HISTORY_ROW_HEIGHT.child,
    HISTORY_ROW_HEIGHT.detail,HISTORY_ROW_HEIGHT.player,HISTORY_ROW_HEIGHT.contact,
  ]);
  const offsets = historyRowOffsets(display);
  assert.deepEqual(offsets, [0,90,146,286,376,466]);
  assert.equal(historyIndexAtOffset(offsets,0),0);
  assert.equal(historyIndexAtOffset(offsets,79),0);
  assert.equal(historyIndexAtOffset(offsets,90),1);
  assert.equal(historyIndexAtOffset(offsets,145),1);
  assert.equal(historyIndexAtOffset(offsets,146),2);
  assert.equal(historyIndexAtOffset(offsets,286),3);
  assert.equal(historyIndexAtOffset(offsets,100000),4);
  assert.equal(inlineRowOnScreen(display,records[1].audioUri,250,200,78),true);
  assert.equal(inlineRowOnScreen(display,records[1].audioUri,300,200,78),false);
  assert.equal(inlineRowOnScreen(display,records[1].audioUri,0,250,78),false);
});
test('details and player appear directly after the selected historical child', () => {
  const records = [call(0),call(1),call(2)];
  const rows = buildDisplayRows(records, records[2].audioUri, {
    isChild: record=>record!==records[0],showDetails:true,
  });
  assert.deepEqual(rows.map(r=>r.key),[
    records[0].audioUri,records[1].audioUri,records[2].audioUri,
    'detail:'+records[2].audioUri,'player:'+records[2].audioUri,
  ]);
  assert.equal(rows.filter(r=>r.kind==='recording').length,3);
});

test('original selected ion-card holds its details while the full player remains below', () => {
  const records = [call(0),call(1),call(2)];
  const rows = buildDisplayRows(records, records[1].audioUri, {
    isChild: r=>r===records[1],
    inlineDetails:true,showDetails:true,showPlayer:false,
  });
  assert.deepEqual(rows.map(x=>x.kind),['recording','recording','recording']);
  assert.deepEqual(rows.map(x=>x.height),[
    HISTORY_ROW_HEIGHT.contact,HISTORY_ROW_HEIGHT.child+HISTORY_ROW_HEIGHT.detail,
    HISTORY_ROW_HEIGHT.contact,
  ]);
  assert.deepEqual(historyRowOffsets(rows),[0,90,286,376]);
  assert.equal(rows.filter(x=>x.kind==='player').length,0);
  assert.equal(rows.filter(x=>x.kind==='detail').length,0);
  // The selected older recording's card remains exactly one CDK item.
  assert.equal(rows[1].key,records[1].audioUri);
  assert.equal(historyIndexAtOffset(historyRowOffsets(rows),100),1);
});
test('original UI style uses the same number of data rows in both selection modes', () => {
  const rows = Array.from({length:29},(_,i)=>call(i));
  const unselected = buildDisplayRows(rows,undefined,{inlineDetails:true,showPlayer:false});
  const selected = buildDisplayRows(rows,rows[12].audioUri,{
    inlineDetails:true,showDetails:true,showPlayer:false,
  });
  assert.equal(unselected.length,29);
  assert.equal(selected.length,29);
  assert.equal(selected[12].height-unselected[12].height,HISTORY_ROW_HEIGHT.detail);
});
