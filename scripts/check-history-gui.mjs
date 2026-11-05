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
assert(page.includes('<app-history-inline-player'), 'Missing shared inline player view');
const inline = read('src/app/features/recording-groups/history-inline-player.component.ts');
assert(inline.includes('height:78px'), 'Inline player height must match virtual rows');
assert(inline.includes('rewind = output') && inline.includes('forward = output'),
  'Inline player must support rewind and fast-forward');
assert(page.includes('collapsed-player-dock'), 'Collapsed contacts must retain playback controls');
assert(controller.includes('buildDisplayRows('), 'View must use the unified row projection');
assert(page.includes('<app-history-controls'), 'Filter controls must be independent');
assert(page.includes('<app-history-details'), 'Recording details must stay outside the viewport');
assert(page.indexOf('<app-history-details') > page.indexOf('</cdk-virtual-scroll-viewport>'),
  'Variable-height details must never be inside virtual rows');
assert(controls.includes('directionChange = output'), 'Missing direction filter output');
assert(details.includes('recording = input.required'), 'Missing recording details input');
assert(player.includes('loadQueue: Promise<void>'), 'Native player switch serialization removed');
assert(player.includes('isReadyFor(recording: Recording)'), 'File-specific readiness guard removed');
const layout = read('src/app/pages/main/main.page.scss');
assert(layout.includes('display:flex;') || layout.includes('display:flex'),
  'Page host must participate in a deterministic vertical layout');
assert(layout.includes('flex:1 1 0;'), 'Ionic content must get remaining page height at first entry');
assert(controller.includes('ResizeObserver'), 'Viewport must react to first-page size changes');
assert(controller.includes('this.displayRows().length;'), 'SAF index updates must trigger CDK remeasurement');
assert(page.includes('(scroll)="onViewportScroll()"'), 'Off-screen playback must follow real scroll position');
assert(controller.includes('inlineRowOnScreen('), 'Mini-player visibility must use viewport intersection');
assert(controller.includes('focusRecording(item)'), 'Selected playback must focus the CDK row');
assert(controller.includes('private selectedUris = signal'), 'Selection must be URI-based');
assert(!/\.selected\s*=/.test(controller), 'Recording objects must not hold mutable GUI selection state');
assert(player.includes('markReadyTimeout('), 'Stalled native prepare must expose a retry state');
assert(player.includes('transportQueue: Promise<void>'), 'Native play/pause/seek must be serialized');
assert(controls.includes('searchDebounce'), 'Toolbar search must avoid scanning every keystroke');

assert(layout.includes('--history-navigation-clearance'), 'History must reserve space for system navigation');
assert(layout.includes('padding-bottom:var(--history-navigation-clearance)'), 'Navigation clearance must protect the list, details and collapsed mini player');
assert(controller.includes('initializing = signal(true)'), 'Initial load state must be visible');
assert(page.includes('recordingsService.lastRefreshError()'), 'Scan failure must have a recovery state');
assert(page.includes('(click)="invertSelection()"'), 'Bulk operations require invert selection');
assert(page.includes('(click)="deselectAll()"'), 'Bulk operations require deselect all');

// The flat layout must retain every public feature from the stable pre-refactor GUI.
const datePipe = read('src/app/pipes/datetime.pipe.ts');
const oldKeys = ['HOME_REC_PHONE_NUMBER', 'HOME_REC_TYPE', 'HOME_REC_SIZE'];
for (const key of oldKeys) assert(details.includes(key), 'Original recording detail missing: ' + key);
assert(row.includes('recording().date | datetime'),
  'List dates must honor the user's date/time format settings');
assert(details.includes('recording().date | datetime'),
  'Detail dates must honor the user's date/time format settings');
assert(datePipe.includes('this.settings.dateTimeFormat'),
  'Configured date/time formats are no longer in use');
assert(datePipe.includes('this.settings.culture'),
  'Configured language no longer determines locale formatting');
assert(inline.includes('<ion-range'), 'Restore Ionic range input with original pin/step behavior');
assert(inline.includes('[pinFormatter]') && inline.includes('[snaps]'),
  'Native Ionic time preview and snapped seeking must be retained');
assert(page.includes('[actionButtons]="actionButtons"'),
  'Original search icon in the header must be preserved');
assert(controller.includes('this.historyControls()?.toggleSearch()'),
  'Header search icon must open and focus the real search field');
assert(controls.includes('nativeElement.focus()'),
  'Opening search must focus the input');
assert(page.includes("HOME_PULL_TO_REFRESH") && page.includes("HOME_REFRESHING"),
  'Pull-to-refresh labels from the original localized interface are missing');
assert(controller.includes('this.selectRecording(item);'),
  'Tapping the group header must select its representative recording');
assert(controller.includes('new Set(item ? [item.audioUri] : [])'),
  'Long-press must initially select only the touched recording');
assert(page.includes('(edit)="editItem(selectedItem()!)"'),
  'The original edit contact/name/copy-number action sheet must stay reachable');
for (const culture of ['en-US', 'zh-Hans', 'zh-Hant']) {
  const translations = JSON.parse(read('src/assets/i18n/' + culture + '.json'));
  for (const key of ['HISTORY_PLAY','HISTORY_SEARCH_HINT','HISTORY_SELECTED',
    'HISTORY_REFRESH','HISTORY_UNKNOWN','HISTORY_PLAYER']) {
    assert(typeof translations[key] === 'string' && translations[key].length,
      culture + ' missing ' + key);
  }
}
assert(!row.includes("navigator.language") && !controls.includes("navigator.language"),
  'UI must not bypass the configured app language');
console.log('Recording GUI architecture checks passed.');
