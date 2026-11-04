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
