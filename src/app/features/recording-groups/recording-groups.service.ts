import { Recording, UNKNOWN_NAME_OR_NUMBER } from 'src/app/models/recording';
import { cleanupPhoneNumber, isPhoneNumber } from 'src/app/utils/phoneNumbers';
import { SortModeEnum, sortRecordings } from 'src/app/utils/recordings-sorter';
import { Injectable, signal } from '@angular/core';

/**
 * Contact grouping and expansion state for the recordings list.
 *
 * Keeping this feature outside MainPage leaves the upstream page responsible
 * only for filtering, playback and recording actions.
 */
@Injectable()
export class RecordingGroupsService {
  readonly expandedGroupKey = signal<string | undefined>(undefined);

  buildGroups(recordings: Recording[], defaultCountryPrefix: string): Map<string, Recording[]> {
    const groups = new Map<string, Recording[]>();

    for (const recording of recordings) {
      const key = this.getGroupKey(recording, defaultCountryPrefix);
      const group = groups.get(key) ?? [];
      group.push(recording);
      groups.set(key, group);
    }

    groups.forEach(group => group.sort((a, b) => b.date - a.date));
    return groups;
  }

  flattenGroups(
    groups: Map<string, Recording[]>,
    sortMode: SortModeEnum,
    defaultCountryPrefix: string,
  ): Recording[] {
    const result: Recording[] = [];
    const headers = Array.from(groups.values(), group => group[0]);

    for (const header of sortRecordings(headers, sortMode)) {
      const key = this.getGroupKey(header, defaultCountryPrefix);
      const group = groups.get(key)!;
      result.push(header);
      if (this.expandedGroupKey() === key) {
        result.push(...group.slice(1));
      }
    }

    return result;
  }

  getGroupKey(recording: Recording, defaultCountryPrefix: string): string {
    const name = recording.opName.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
    if (name && name !== UNKNOWN_NAME_OR_NUMBER && !isPhoneNumber(recording.opName)) {
      return `name:${name}`;
    }

    let number = cleanupPhoneNumber(recording.opNumber);
    const prefix = cleanupPhoneNumber(defaultCountryPrefix);

    if (prefix && number.startsWith('0')) {
      number = prefix + number.substring(1);
    }

    // Never merge all private/unknown calls into one unrelated contact.
    return number ? `number:${number}` : `recording:${recording.audioUri}`;
  }

  isGroupHeader(
    recording: Recording,
    groups: Map<string, Recording[]>,
    defaultCountryPrefix: string,
  ): boolean {
    return groups.get(this.getGroupKey(recording, defaultCountryPrefix))?.[0] === recording;
  }

  getGroupCount(
    recording: Recording,
    groups: Map<string, Recording[]>,
    defaultCountryPrefix: string,
  ): number {
    return groups.get(this.getGroupKey(recording, defaultCountryPrefix))?.length ?? 1;
  }

  toggle(recording: Recording, defaultCountryPrefix: string): void {
    const key = this.getGroupKey(recording, defaultCountryPrefix);
    this.expandedGroupKey.update(current => current === key ? undefined : key);
  }

  expand(recording: Recording, defaultCountryPrefix: string): void {
    this.expandedGroupKey.set(this.getGroupKey(recording, defaultCountryPrefix));
  }

  collapseForDifferentGroup(recording: Recording, defaultCountryPrefix: string): void {
    const expanded = this.expandedGroupKey();
    if (expanded && expanded !== this.getGroupKey(recording, defaultCountryPrefix)) {
      this.expandedGroupKey.set(undefined);
    }
  }

  isDialable(recording: Recording): boolean {
    return recording.opNumber !== UNKNOWN_NAME_OR_NUMBER && isPhoneNumber(recording.opNumber);
  }

  getDialUri(recording: Recording): string {
    return `tel:${cleanupPhoneNumber(recording.opNumber)}`;
  }
}
