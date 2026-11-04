import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = path => readFileSync(path, 'utf8');
const page = read('src/app/pages/main/main.page.html');
const controller = read('src/app/pages/main/main.page.ts');
const row = read('src/app/features/recording-groups/history-recording-row.component.ts');
const controls = read('src/app/features/recording-groups/history-controls.component.ts');
const details = read('src/app/features/recording-groups/history-details.component.ts');
const player = read('src/app/components/audio-player/audio-player.component.ts');

assert.equal((page.match(/<app-audio-player\b/g) ?? []).length, 1,
  'Only one persistent audio player is allowed in the GUI');
assert.equal((page.match(/<cdk-virtual-scroll-viewport\b/g) ?? []).length, 1,
  'Only one virtual-scroll viewport is allowed');
assert(!page.includes('<ion-card'), 'The old variable-height card list must not return');
assert(page.includes('[itemSize]="itemHeight"'), 'CDK must use the fixed model row height');
assert(controller.includes('protected itemHeight = 78;'), 'The controller row height has changed');
assert(row.includes('height:78px'), 'The row height no longer matches CDK itemSize');
assert(page.includes("entry.kind === 'recording'"), 'Missing fixed-size inline player row');
assert(page.includes('class="inline-playback"'), 'Missing inline timeline');
assert(controller.includes('buildDisplayRows('), 'View must use the unified row projection');
assert(page.includes('<app-history-controls'), 'Filter controls must be independent');
assert(page.includes('<app-history-details'), 'Recording details must stay outside the viewport');
assert(page.indexOf('<app-history-details') > page.indexOf('</cdk-virtual-scroll-viewport>'),
  'Variable-height details must never be inside virtual rows');
assert(controls.includes('directionChange = output'), 'Missing direction filter output');
assert(details.includes('recording = input.required'), 'Missing recording details input');
assert(player.includes('loadQueue: Promise<void>'), 'Native player switch serialization removed');
assert(player.includes('isReadyFor(recording: Recording)'), 'File-specific readiness guard removed');
console.log('Recording GUI architecture checks passed.');
