import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = path => readFileSync(path, 'utf8');
const page = read('src/app/pages/main/main.page.html');
const controller = read('src/app/pages/main/main.page.ts');
const row = read('src/app/features/recording-groups/history-recording-row.component.ts');
const controls = read('src/app/features/recording-groups/history-controls.component.ts');
const details = read('src/app/features/recording-groups/history-details.component.ts');
const player = read('src/app/components/audio-player/audio-player.component.ts');
const inline = read('src/app/features/recording-groups/history-inline-player.component.ts');
const projection = read('src/app/features/recording-groups/history-display-rows.ts');
const strategy = read('src/app/features/recording-groups/history-variable-scroll.directive.ts');
const style = read('src/app/pages/main/main.page.scss');
const datePipe = read('src/app/pipes/datetime.pipe.ts');

// One native engine, one virtual viewport, no old fixed-height overlap.
assert.equal((page.match(/<app-audio-player\b/g) ?? []).length, 1, 'Only one native audio engine');
assert.equal((page.match(/<cdk-virtual-scroll-viewport\b/g) ?? []).length, 1, 'Only one viewport');
assert(page.includes('[historyVariableScroll]="displayRows()"'), 'Variable-size strategy must be attached');
assert(!page.includes('[itemSize]'), 'Fixed-size CDK cannot render 48/80/170px rows safely');
assert(strategy.includes('VIRTUAL_SCROLL_STRATEGY') && strategy.includes('historyRowOffsets'),
  'Virtual strategy must use accurate prefix-sum offsets');
assert(projection.includes('child: 48') && projection.includes('contact: 80') &&
  projection.includes('detail: 170') && projection.includes('player: 90'),
  'Actual per-row height projection lost');
assert(controller.includes('buildDisplayRows(') && controller.includes('showDetails: !this.isMultiselect()'),
  'Selected details must be projected as virtual rows');
assert(page.includes("entry.kind === 'detail'") && page.includes('<app-history-details'),
  'Recording details must expand directly beneath the selected recording');
assert(page.indexOf('<app-history-details') < page.indexOf('</cdk-virtual-scroll-viewport>'),
  'Details must be part of the scrollable recording history, not a fixed dock');
assert(page.includes('<app-history-inline-player') && page.includes('collapsed-player-dock'),
  'Inline and offscreen playback controls must both remain');
assert(inline.includes('<ion-range') && inline.includes('[pinFormatter]') && inline.includes('[snaps]'),
  'Ionic native progress preview, snapping and step controls lost');
assert(player.includes('loadQueue: Promise<void>') && player.includes('transportQueue: Promise<void>'),
  'Native audio loads and transport must remain serialized');
assert(player.includes('markReadyTimeout(') && player.includes('isReadyFor(recording: Recording)'),
  'Failed native loads must be retryable');
assert(controller.includes('inlineRowOnScreen(') && page.includes('(scroll)="onViewportScroll()"'),
  'Audio dock must use real scroll intersection, not list membership');
assert(controller.includes('focusRecording(item)'), 'Skipping must focus the target record');

// Restore the original card visual hierarchy without reintroducing unbounded heights.
assert(row.includes('is-child') && row.includes('child-info'), 'History child rows must be compact');
assert(!row.includes('class="avatar"'), 'The new avatar-first layout replaced original card structure');
assert(row.includes('border-radius:10px') && row.includes('margin:3px 12px'),
  'Contact cards must preserve radius and side gutters');
assert(details.includes('height:calc(100% - 4px)'),
  'Details component must stay inside the measured CDK item');
assert(inline.includes('height:90px'), 'Inline player must match its measured CDK item');

// Same action surface, locale and original grouped selection semantics.
for (const key of ['HOME_REC_PHONE_NUMBER', 'HOME_REC_TYPE', 'HOME_REC_SIZE']) {
  assert(details.includes(key), 'Missing original detail field: ' + key);
}
assert(details.includes('recording().date | datetime') &&
  row.includes('recording().date | datetime') &&
  datePipe.includes('this.settings.dateTimeFormat') &&
  datePipe.includes('this.settings.culture'), 'Configured date and locale must be honoured');
assert(page.includes('(edit)="editItem(entry.recording)"') &&
  page.includes('(share)="shareRecording(entry.recording)"') &&
  page.includes('(delete)="deleteItems([entry.recording])"'),
  'Edit/share/delete must remain attached to the selected record');
assert(page.includes('[actionButtons]="actionButtons"') &&
  controller.includes('this.historyControls()?.toggleSearch()') &&
  controls.includes('nativeElement.focus()'), 'Original header search / autofocus lost');
assert(controls.includes('showOptions = signal(false)') && controls.includes('directionChange = output'),
  'New direction/sort tools must be available but not consume permanent vertical space');
assert(controller.includes('private selectedUris = signal') &&
  controller.includes('setGroupSelection(old, [item])') &&
  row.includes('groupSelectClicked = output'),
  'URI-based single/group selection must stay distinct');
assert(!/\.selected\s*=/.test(controller), 'Do not mutate stale Recording.selected flags');
assert(page.includes("HOME_PULL_TO_REFRESH") && page.includes("HOME_REFRESHING"),
  'Original pull-to-refresh labels lost');
assert(style.includes('flex:1 1 0;') && controller.includes('ResizeObserver'),
  'Initial scrolling must not depend on mounting the player');
assert(style.includes('--history-navigation-clearance') &&
  style.includes('padding-bottom:var(--history-navigation-clearance)'),
  'Android bottom navigation must not obscure the final item or player');
const groupService = read('src/app/features/recording-groups/recording-groups.service.ts');
assert(groupService.includes('group.sort((a, b) => b.date - a.date)'),
  'Contact header must be newest call');
assert(groupService.indexOf('const name =') < groupService.indexOf('let number ='),
  'Original grouping must prioritize known contact names');
for (const culture of ['en-US','zh-Hans','zh-Hant']) {
  const translations = JSON.parse(read('src/assets/i18n/' + culture + '.json'));
  for (const key of ['HISTORY_PLAY','HISTORY_SEARCH_HINT','HISTORY_SELECTED','HISTORY_PLAYER',
    'HISTORY_SELECT_GROUP','HISTORY_DESELECT_GROUP']) {
    assert(typeof translations[key] === 'string' && translations[key].length,
      culture + ' missing ' + key);
  }
}
console.log('Variable-height original-layout BCR-GUI architecture checks passed.');
