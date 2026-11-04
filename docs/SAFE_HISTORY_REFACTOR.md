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
