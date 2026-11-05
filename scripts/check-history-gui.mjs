import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = path => readFileSync(path,'utf8');
const page = read('src/app/pages/main/main.page.html');
const controller = read('src/app/pages/main/main.page.ts');
const styles = read('src/app/pages/main/main.page.scss');
const row = read('src/app/features/recording-groups/history-recording-row.component.ts');
const title = read('src/app/features/recording-groups/recording-group-title.component.html');
const titleStyle = read('src/app/features/recording-groups/recording-group-title.component.scss');
const toolbar = read('src/app/features/recording-groups/history-controls.component.ts');
const player = read('src/app/components/audio-player/audio-player.component.ts');
const originalPlayer = read('src/app/components/audio-player/audio-player.component.html');
const projection = read('src/app/features/recording-groups/history-display-rows.ts');
const strategy = read('src/app/features/recording-groups/history-variable-scroll.directive.ts');

assert.equal((page.match(/<app-audio-player\b/g) ?? []).length,1,'One native audio player');
assert.equal((page.match(/<cdk-virtual-scroll-viewport\b/g) ?? []).length,1,'One CDK viewport');
// The original card DOM and controls must be used, not a CSS approximation.
assert(row.includes('<ion-card class="item"') && row.includes('<ion-card-header'),
  'Upstream ion-card markup must render recordings');
assert(row.includes('<ion-card-content class="content">') &&
  row.includes("HOME_REC_PHONE_NUMBER") && row.includes("HOME_REC_TYPE") &&
  row.includes("HOME_REC_SIZE"),'Upstream inline detail markup must be preserved');
assert(row.includes('name="pencil"') && row.includes('name="share-social"') &&
  row.includes('name="trash"'),'Upstream action icons changed');
assert(row.includes('border-radius:10px') && row.includes('border-left:3px') &&
  row.includes('box-shadow:0 5px 7px'),
  'Upstream rounded/shadowed cards and indented child styling changed');
assert(title.includes('<ion-card-title class="title">') &&
  title.includes('play-circle-outline') && titleStyle.includes('font-size: 14pt'),
  'Original caller header component must be reused');
assert(!row.includes('class="avatar"'),'Avatar-first redesign must not return');
assert(styles.includes('grid-template-rows:minmax(0,1fr) min-content') &&
  styles.includes('padding:1em') && page.includes('class="player"'),
  'Original full bottom player and grid page layout must be used');
assert(originalPlayer.includes('<ion-range') && originalPlayer.includes('buttons-center') &&
  originalPlayer.includes('play-skip-back') && originalPlayer.includes('play-forward'),
  'Original full audio transport UI changed');
assert(toolbar.includes('<ion-searchbar') && toolbar.includes('[debounce]="750"') &&
  toolbar.includes('setFocus()'),'Original Ionic search bar and focus handling changed');
assert(toolbar.includes('filtersVisible = signal(false)') &&
  controller.includes('toggleFilters()'),
  'New filters may remain but must not replace the original default top layout');

// Only recording DATA and virtualization are modernized. Selected details share
// the SAME virtual card row, with an exact declared height; no overlap.
assert(page.includes('[historyVariableScroll]="displayRows()"') &&
  !page.includes('[itemSize]'),'Heterogeneous card heights require the variable strategy');
assert(controller.includes('inlineDetails: true') && controller.includes('showPlayer: false'),
  'Details belong inside the card; the player is a separate bottom component');
assert(projection.includes('inlineDetailsHeight') && strategy.includes('historyRowOffsets'),
  'Selected cards must be measured instead of drawing over adjacent rows');
assert(projection.includes('contact: 90') && projection.includes('child: 56'),
  'Original card geometry or gap has changed');
assert(page.includes('[style.height.px]="entry.height"'),
  'Rendered card height must match the projected CDK height');

// Keep all the new recording DATA and safety protections unchanged.
assert(controller.includes('buildRecordingHistory(') &&
  controller.includes('filterRecordingDirection(') &&
  controller.includes('projectRecordingHistory('),
  'Current filter/sort/group data pipeline must be preserved');
assert(controller.includes('private selectedUris = signal') &&
  controller.includes('setGroupSelection(old, [item])'),
  'URI-backed selection must not regress to mutable Recording.selected');
assert(!/\.selected\s*=/.test(controller),'Do not mutate Recording.selected flags');
assert(player.includes('loadQueue: Promise<void>') &&
  player.includes('transportQueue: Promise<void>') &&
  player.includes('markReadyTimeout('),
  'Current native playback serialisation and retry must remain');
const datePipe = read('src/app/pipes/datetime.pipe.ts');
assert(row.includes('recording().date | datetime') &&
  datePipe.includes('this.settings.dateTimeFormat') &&
  datePipe.includes('this.settings.culture'),
  'Original date formatting and configured locale must still be used');
assert(styles.includes('--history-navigation-clearance') &&
  styles.includes('padding-bottom:var(--history-navigation-clearance)'),
  'Android system navigation must not cover the bottom player');
assert(controller.includes('ResizeObserver') &&
  controller.includes('this.displayRows().length;'),
  'First-entry CDK resize and loaded index handling must remain');
assert(page.includes('HOME_PULL_TO_REFRESH') && page.includes('HOME_REFRESHING'),
  'Original pull-to-refresh labels missing');
assert(page.includes('(edit)="editItem(entry.recording)"') &&
  page.includes('(share)="shareRecording(entry.recording)"') &&
  page.includes('(delete)="deleteItems([entry.recording])"'),
  'Old recording detail actions must remain wired');
const groups = read('src/app/features/recording-groups/recording-groups.service.ts');
assert(groups.includes('group.sort((a, b) => b.date - a.date)') &&
  groups.indexOf('const name =') < groups.indexOf('let number ='),
  'Current contact grouping data must not change');
for (const culture of ['en-US','zh-Hans','zh-Hant']) {
  const translation = JSON.parse(read('src/assets/i18n/'+culture+'.json'));
  for (const name of ['HISTORY_PLAY','HISTORY_SELECTED','HISTORY_SELECT_GROUP',
    'HISTORY_DESELECT_GROUP']) {
    assert(typeof translation[name]==='string',culture+' missing '+name);
  }
}
console.log('Original BCR-GUI visuals + current indexed recording data checks passed.');
