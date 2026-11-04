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
folder. BCR-GUI now scans the selected root plus its immediate `VoIP/` child
folder (if present), and recognizes both `audio/wav` and `audio/x-wav`.
No arbitrary recursion, no additional storage permission, and no change
to the underlying recording engine or Android privileges. Unknown
VoIP filenames retain their ordinary file-record behavior.

## Playback seek-bar regression fix

The original call-history refactor collapsed the existing full player into a
1 px hidden container, but Play did not expand it. Clicking Play on a row or
history item now sets `playerExpanded=true` **before** loading/starting
playback. Android VIEW intents also expand the full player.
The mini controller displays its own read-only progress bar and elapsed/total
time using the exact signals from the existing `AudioPlayerComponent`:
no duplicate timer, playback engine or seek implementation is introduced.
Tapping the compact progress bar expands the full seek controls, and manually
collapsing the full panel keeps playback and progress updates running.

## Inline progress below the call play button

The standalone and Suite GUI now insert a **second fixed-size CDK virtual row**
directly after the active caller summary. This holds an Ionic seek slider,
elapsed/total time, -10/+10 second buttons, pause/resume, speed and close.
All other summary rows keep their original 86px height, so virtualization is
not forced to measure dynamic expanded cards. Selecting another call moves the
inline progress to the new call; tapping the same play button toggles playback.

The real `AudioPlayerComponent` remains **persistently mounted outside the
virtual viewport** while a recording is selected. The inline row only reflects
its signals and sends actions to its playback methods, so scrolling a row out
of view does not destroy or restart the native audio session. No duplicate
audio engine, timer, or file reads are introduced.

## Fix: inline player must not paint across later call rows

The progress row has exactly the same 86px fixed size as every other CDK
item. The first inline version allowed Ionic's range control and its pin
tooltip to overflow beyond the allocated item, which could visually cover
another call row despite the virtual strategy reserving a row. The inline
player now uses a strict two-track grid inside a border-box-sized host,
restrains `ion-range` dimensions, disables the out-of-row pin overlay
(current time is already displayed separately) and clips the dedicated
virtual row. This does not clip the normal contact summary or change the
overall item count. When a recording is selected, the viewport's size
is also checked after Angular applies the inserted row.

No absolute-positioned overlay or extra blank spacer rows are used.
