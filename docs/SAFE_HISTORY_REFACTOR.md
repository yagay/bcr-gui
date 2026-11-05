# Safe recording-list refactor

Baseline: the known-good BCR-GUI list restored from commit `b702948`.

## Invariants
- One recording index: `RecordingsService.recordings`; the UI never scans SAF.
- `buildRecordingHistory` only filters/sorts copies; no hidden persistent list.
- Contact expansion delegates to the original `RecordingGroupsService`.
- One CDK viewport uses the unchanged `itemHeight + itemGap` layout.
- One original `AudioPlayerComponent`; no second player or modal progress state.
- Every item action keeps its original `Recording` reference.
- Refresh completion awaits indexing and requests a viewport remeasurement.
- Delete completion is awaited before clearing the selection.

Regression data: 29 audio records / 11 caller groups, including an unknown-caller isolation case.

The flat visual changes are intentionally CSS-only. Future UI redesigns should
update one layer at a time and run these regression checks first.

## Complete GUI architecture (November 2026)

The display layer now consists of:
- `HistoryControlsComponent`: call direction and VoIP filters, counters, and mode/refresh.
- `HistoryRecordingRowComponent`: fixed 78px accessible recording row; play/pause and long-press.
- `HistoryDetailsComponent`: independent fixed dock for the selected file's actions.
- `MainPage`: a single state coordinator, one CDK virtual viewport, one native-backed AudioPlayer.
- `recording-history.model.ts`: pure filter/sort/integrity functions; no SAF logic in UI.
- `RecordingGroupsService`: phone-number-first grouping; unknown callers never merged.
- Native audio player: serialized load/unload, stale generation ignored, last-request-wins.

The display uses complete recorded files for all operations, never just the
visible contact summaries. Contact grouping is display-only; per-record
playback/edit/share/delete always targets the actual Recording.

Run `npm run build` and `node scripts/check-history-gui.mjs`; CI additionally
type-checks history regression tests and assembles Android arm64 debug.

A passing CI validates compilation and invariants, not physical device audio.

## Fixed-height inline playback

Every virtual row is 78px; playback inserts an extra `kind: 'player'` row
immediately after the selected recording and never changes another row's
height. The only audio engine remains `AudioPlayerComponent` outside the
virtual viewport, visually hidden so the new inline UI is its sole controller.
An item whose player preparation failed displays a retry control.

The HistoryControls toolbar owns search, direction, sorting, view mode, refresh,
and reset. A group header has tri-state selection, while an expanded child
always selects just its own file.

The CI workflow runs actual node:test tests using Node 24's built-in
TypeScript stripping and also type-checks Angular/Jasmine regression sources.
The Android APK still requires successful CI and device-level playback checks.

## First-entry viewport stability

The page host uses a full-height column flexbox and `ion-content` occupies the
remaining height. A ResizeObserver watches both the CDK viewport and its parent.
The reactive display-row count schedules one CDK `checkViewportSize()` per frame,
including after the initial asynchronous SAF scan. Playback is never required to
force the list to become scrollable.

## Collapsed contact player and navigation clearance

The playback controller is one reusable 78px component, displayed as a CDK row
for visible recordings or as a dock when the active recording is hidden by a
collapsed contact. Only the view moves; the native audio engine is unchanged.
The Ionic content reserves Android navigation safe space at the whole
`history-layout` level, so the dock and detail buttons are also reachable.

Group header taps only expand or collapse. The header's dedicated play button
plays the representative recording. In multiselect mode, group headers select
the full group and children select themselves. Invert/deselect-all act on the
complete filtered source list, independent of CDK viewport rendering.

## Final call-history interaction pass

- The player is a fixed 78px CDK row when fully visible, or a matching
  78px dock when outside the actual measured viewport. `scrollTop` and
  `viewportHeight` drive this, not mere membership in the filtered array.
- Previous/next playback centers the target history row through the CDK
  viewport (with the existing 3-second previous-to-start behavior).
- Multi-select tracks **audioUri** in an immutable Set; group header selection
  is tri-state, subrows select just their recording, invert affects the full
  filtered index, and stale Recording.selected mutation is not used.
- A native player that never becomes ready after 12 seconds is marked
  retryable. Loading, play/pause, seeking, and speed changes share a serial
  transport queue with generation checks; native load/unload remains serial.
- The search, sort and direction filters use a compact two-row toolbar, with
  debounced text input. Short phone screens can horizontally scroll filters.
- Row dates show Today/Yesterday according to device local calendar, then
  absolute date/time using the user's 12/24 hour setting.
- VoIP detection uses the explicit BCR folder first, then well-defined
  app markers across audio formats (without claiming all .wav files are VoIP).
- Regression checks cover 29-record completeness, viewport/dock transitions,
  contact selection, dates, and VoIP classification. Angular and APK builds
  still run in Actions; actual device scroll, gesture and audio behavior needs
  on-device validation.

## Stable GUI feature parity restoration (November 2026)

The current flat history UI retains the old functional controls:
- Toolbar **search icon** opens the search input with keyboard focus. The
  search/filter/sort model remains the new single history model.
- Tapping a collapsed contact row **expands and selects** its representative
  recording, matching the old behavior; the chevron only expands/collapses;
  the separate play icon only controls playback. Long-press starts selection
  on that one recording rather than implicitly selecting an entire group.
- Recording details show full original phone number (clickable when dialable),
  MIME type, file size, date and the existing edit-contact/name/copy-number
  action sheet. The independent details dock stays outside the CDK viewport.
- The original Ionic ion-range controller has a pin formatter, duration-aware
  step, snapping and seek preview while dragging. The actual native audio
  engine is still shared by both inline and collapsed views.
- Row and detail dates use the original DatetimePipe and all saved
  settings.dateTimeFormat options, including the custom format and 12/24-hour
  preference. Language uses the app's I18nService translation resources, not
  navigator.language. New labels are in en-US, zh-Hans and zh-Hant with
  existing English fallbacks for other languages.
- The pull-to-refresh control again exposes the original translated
  instructions and pull distance; the toolbar refresh action also remains.
- Native Suite-only BCR settings and GUI settings stay separate, with
  independent Suite SAF DB indexing.
- CI continues to build **Debug only** on this feature branch, and structural
  checks fail if a former feature is removed by a future layout change.

## Variable-height history layout parity (November 2026)

This revision corrects the remaining layout mismatch without reintroducing the
old card-in-fixed-CDK-row overflow. A standalone variable-size scroll strategy
uses a prefix-sum table of **physical row heights**, and renders only the
visible range plus a 600px buffer. Main contact cards are 80px, child calls
48px, an expanded detail row 170px, and an inline player 90px; no two rows
occupy the same physical area.

The selected file's detail panel now follows the corresponding list entry,
restoring the original selection hierarchy and keeping edit/share/delete
actions with that recording. Playback follows the details; when scrolled out
of view, a compact bottom playback dock keeps the same single native engine
accessible. The toolbar's filter chips remain visible while sorting, counts
and view mode move into one optional row. The multiselection toolbar keeps
select-all/delete and puts invert/deselect in its overflow menu.

The original recording reader, database, BCR's own settings and BCR core are
unchanged. Debug-only CI checks the structural parity and executes variable
height/scroll/29-record integrity tests; actual touch behaviour still requires
on-device checking.

## Full original GUI style with current recording data (November 2026)

The page now reuses the **actual upstream ion-card / recording-group-title**
templates and styles, the original bottom audio-player HTML/SCSS and the
original Ionic toolbar-search appearance. It does not attempt to imitate the
old controls with custom buttons, avatar rows, an inline audio dock or detached
detail panels. Selected details render inside their recording card, matching
the upstream hierarchy. The extra new filter/sort/VoIP functions remain
accessible from a collapsed header options menu.

Only the data/virtualization layer differs: the current SAF index, search,
direction filtering, stable contact grouping, sort modes, URI-backed
selection, and serialized native player are retained. The selected row
advertises its true (base+details) height to the variable-size CDK strategy.
The **full original bottom player** always occupies the page's second grid
row while a recording is selected, without hiding behind an off-screen
placeholder. Scroll geometry and bottom system navigation safety remain
managed explicitly. Android Debug is the only automatic build in this branch.
