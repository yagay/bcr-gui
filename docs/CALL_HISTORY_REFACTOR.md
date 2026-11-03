# Call-history UI refactor (feature/call-log-ui)

## Scope

The main screen is now a compact, flat call-recording history instead of a set
of expandable file cards.

- The CDK virtual scroll contains **fixed-height 86 px rows**. Contact history
  opens in a separate Ionic modal sheet, so expanded details do not invalidate
  virtual-scroll offsets.
- Main list has All / Incoming / Outgoing / VoIP filters, localized for Chinese
  or English, plus existing full-text search and a calendar date caption.
- A distinct play action starts the existing native player without opening
  details. The player remains mounted while collapsed into a mini bar, so audio
  continues when the expanded controls are hidden.
- Call details expose original recording file metadata, play, edit, share and
  delete through the same upstream SAF/audio services.
- Grouping uses a normalized dialable number **before** caller display name;
  private/unknown recordings remain separate, avoiding merging unrelated people.
- The VoIP filter conservatively recognizes the exact filename pattern written
  by the experimental BCR Root VoIP recorder. It does not infer WhatsApp calls
  from filenames in arbitrary formats.
- The interface displays **recordings**, not undocumented system phone history.
  Missed or unrecorded calls do not appear.

## Data boundaries

- `RecordingsService` remains the single source of truth for file discovery,
  metadata, indexed cache, SAF grants and deletion.
- `RecordingGroupsService` determines identity without storing contact data
  in a second database.
- `features/call-history/call-history.ts` is a pure filter/label function,
  and includes regression tests.
- Existing `AudioPlayerComponent` manages audio lifecycle. The only engine
  change is exposing `togglePlayPause` and `isPlaying` for the mini bar.

## Upstream updates

`dev` remains the unchanged upstream-sync branch in `yagay/bcr-gui`.
The new UI lives in `feature/call-log-ui`, built and tested by its own CI.
BCR Suite can point its `external/bcr-gui` Git submodule at the tested
feature commit while preserving upstream histories.

## Limitations

BCR's experimental VoIP recorder may output to `VoIP/` below the configured
folder. The original BCR-GUI SAF scanner only reads the selected directory,
so subdirectories may not be discovered. This change does not claim the
VoIP filter provides full recursive scanning, and it does not change the
underlying recording engine or Android privileges.
