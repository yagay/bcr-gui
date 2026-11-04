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
