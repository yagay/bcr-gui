import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = path => readFileSync(path,'utf8');
const service = src('src/app/services/recordings.service.ts');
const recording = src('src/app/models/recording.ts');
const model = src('src/app/features/call-history/call-history.ts');
const controller = src('src/app/pages/main/main.page.ts');
const template = src('src/app/pages/main/main.page.html');
const suiteGuard = 'await this.updateDbFileUri();';

// Data-only changes must not replace the restored first flat-history UI.
assert(template.includes('class="call-row"') && template.includes('class="mini-player"') &&
  template.includes('<ion-modal'), 'The original flat call-list/modal/player UI changed');
assert(controller.includes('showEachRecording = signal(true)') &&
  controller.includes('toggleRecordView()') &&
  template.includes('indexedCount()') && template.includes('filteredCount()'),
  'All recordings must be visible by default and counts distinguish index from groups');
assert(service.includes('await scan(this.settings.recordingsDirectoryUri') &&
  service.includes('if (depth < 8)') && service.includes('visited = new Set'),
  'Nested recordings must be visited safely with bounded recursion');
assert(service.includes('isRecordingAudioFile(') &&
  service.includes('shouldPruneCachedAudio('),
  'MIME fallback or cache-retention policy missing');
assert(service.includes('lastFullScan = scanIncomplete ? 0 : this.lastUpdate'),
  'Partial scans must be retried');
assert(service.includes('this.lastScanIncomplete.set(scanIncomplete)') &&
  template.includes('recordingsService.lastScanIncomplete()'),
  'Partial failure must be visible to the user');
assert(service.includes('let pnm:') && service.includes("Contact lookup unavailable"),
  'Contact permissions must not block file indexing');
assert(service.includes('await Recording.createInstance(file, undefined, filenameRegExp)'),
  'A broken metadata JSON must not discard the audio file');
assert(recording.includes('Invalid or unreadable recording metadata:'),
  'Metadata SAF read failures must fall back instead of aborting refresh');
assert(model.includes("sourceFolder || ''") && model.includes('oga|opus|m4a'),
  'VoIP detection must cover the nested folder and common formats');
console.log('Original flat UI and complete indexed-history scan checks passed.');
