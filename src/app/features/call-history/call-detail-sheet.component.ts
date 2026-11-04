import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { CallIconComponent } from 'src/app/components/call-icon/call-icon.component';
import { LongPressDirective } from 'src/app/directives/long-press.directive';
import { Recording } from 'src/app/models/recording';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { CallInlinePlayerComponent } from './call-inline-player.component';
import { localDayKey } from './call-history';

/** Contact history is its own scrollable sheet, not a second file manager. */
@Component({
  selector: 'app-call-detail-sheet',
  standalone: true,
  templateUrl: './call-detail-sheet.component.html',
  styleUrls: ['./call-detail-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonicBundleModule, CallIconComponent, CallInlinePlayerComponent,
    LongPressDirective, FilesizePipe, ToHmsPipe,
  ],
})
export class CallDetailSheetComponent {
  readonly recordings = input<Recording[]>([]);
  readonly title = input('');
  readonly isZh = input(false);
  readonly playingRecording = input<Recording | undefined>(undefined);
  readonly showProgress = input(false);
  readonly position = input(0);
  readonly duration = input(0);
  readonly ready = input(false);
  readonly playing = input(false);
  readonly speed = input(1);

  readonly close = output<void>();
  readonly play = output<Recording>();
  readonly playPause = output<void>();
  readonly seek = output<number>();
  readonly changeSpeed = output<void>();
  readonly closeProgress = output<void>();
  readonly edit = output<Recording>();
  readonly share = output<Recording>();
  readonly delete = output<Recording[]>();

  private actions = inject(ActionSheetController);
  protected selectedUris = signal<Set<string>>(new Set());

  protected count = computed(() => this.recordings().length);
  protected phone = computed(() => {
    const first = this.recordings()[0];
    const number = first?.opNumber?.trim() ?? '';
    return number && !number.includes('<') && /^[+0-9()\s.-]{5,}$/.test(number)
      ? number : '';
  });

  protected text(zh: string, en: string): string {
    return this.isZh() ? zh : en;
  }

  protected clock(timestamp: number): string {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    return new Intl.DateTimeFormat(this.isZh() ? 'zh-CN' : 'en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(timestamp));
  }

  protected day(timestamp: number): string {
    const key = localDayKey(timestamp);
    if (!key) return this.text('未知日期', 'Unknown date');
    const now = new Date();
    if (key === localDayKey(now.getTime())) return this.text('今天', 'Today');
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (key === localDayKey(yesterday.getTime())) return this.text('昨天', 'Yesterday');
    return new Intl.DateTimeFormat(this.isZh() ? 'zh-CN' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(timestamp));
  }

  protected newDay(index: number): boolean {
    const list = this.recordings();
    return index === 0 || localDayKey(list[index - 1].date) !== localDayKey(list[index].date);
  }

  protected direction(recording: Recording): string {
    if (recording.direction === 'in') return this.text('来电', 'Incoming');
    if (recording.direction === 'out') return this.text('去电', 'Outgoing');
    return this.text('录音', 'Recording');
  }

  protected isSelected(recording: Recording): boolean {
    return this.selectedUris().has(recording.audioUri);
  }

  protected startSelection(recording: Recording): void {
    this.selectedUris.set(new Set([recording.audioUri]));
  }

  protected toggleSelection(recording: Recording): void {
    if (!this.selectedUris().size) return;
    const next = new Set(this.selectedUris());
    if (next.has(recording.audioUri)) next.delete(recording.audioUri);
    else next.add(recording.audioUri);
    this.selectedUris.set(next);
  }

  protected clearSelection(): void { this.selectedUris.set(new Set()); }

  protected deleteSelected(): void {
    const picked = this.recordings().filter(r => this.selectedUris().has(r.audioUri));
    this.clearSelection();
    if (picked.length) this.delete.emit(picked);
  }

  protected async showActions(recording: Recording): Promise<void> {
    if (this.selectedUris().size) {
      this.toggleSelection(recording);
      return;
    }
    const sheet = await this.actions.create({
      header: this.clock(recording.date),
      buttons: [
        { text: this.text('编辑', 'Edit'), icon: 'pencil-outline',
          handler: () => this.edit.emit(recording) },
        { text: this.text('分享', 'Share'), icon: 'share-social-outline',
          handler: () => this.share.emit(recording) },
        { text: this.text('删除', 'Delete'), role: 'destructive', icon: 'trash-outline',
          handler: () => this.delete.emit([recording]) },
        { text: this.text('取消', 'Cancel'), icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
