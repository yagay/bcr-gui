import { Subscription } from 'rxjs';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { Recording } from 'src/app/models/recording';
import { toHms, ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { MessageBoxService } from 'src/app/services/message-box.service';
import { RecordingsService } from 'src/app/services/recordings.service';
import { SettingsService } from 'src/app/services/settings.service';
import { AudioPlayer } from 'src/plugins/audioplayer';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, input, OnDestroy, OnInit, output, signal, untracked } from '@angular/core';
import { RangeCustomEvent } from '@ionic/angular';

export enum PlayerStatusEnum {
  Paused = 0,
  Playing = 10,
}

export type SkipDirection = 'prev' | 'next';
export type SeekMode = 'begin' | 'rew' | 'fwd';

@Component({
  selector: 'app-audio-player',
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.scss'],
  standalone: true,
  imports: [ IonicBundleModule, ToHmsPipe ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioPlayerComponent implements OnInit, OnDestroy {

  PlayerStatusEnum = PlayerStatusEnum;

  // player status
  protected ready = signal(false);
  protected status = signal(PlayerStatusEnum.Paused);
  protected progress = signal(0);       // current play position (in integer seconds)
  protected duration = signal(0);       // audio duration in seconds

  // subscriptions
  private _androidEventsSubs = new Subscription();
  private removePlayerReadyListener?: () => Promise<void>;
  private removePlayerUpdateListener?: () => Promise<void>;
  private removePlayCompletedListener?: () => Promise<void>;
  // Android exposes one native player; never overlap load/unload operations.
  private loadQueue: Promise<void> = Promise.resolve();
  private loadGeneration = 0;
  private loadedRecording?: Recording;
  private nativeLoadAttempted = false;
  private destroying = false;

  // inputs
  public recording = input.required<Recording>();

  // button events
  public onSkip = output<SkipDirection>();

  // knob
  protected isDraggingKnob = signal(false);

  constructor(
    private cdr: ChangeDetectorRef,
    private mbs: MessageBoxService,
    private recordingsService: RecordingsService,
    protected settings: SettingsService,
  ) {
    // The effect tracks ONLY the recording input. Native-player lifecycle
    // state writes must run outside Angular 18's reactive consumer; otherwise
    // ready/status/progress.set() throws NG0600 on every recording switch.
    effect(() => {
      const next = this.recording();
      untracked(() => this.scheduleRecordingSwitch(next));
    });
  }

  private scheduleRecordingSwitch(next: Recording) {
    if (this.destroying) return;
    const generation = ++this.loadGeneration;
    // Invalidate old callbacks synchronously before any asynchronous unload.
    this.ready.set(false);
    this.loadedRecording = undefined;
    this.status.set(PlayerStatusEnum.Paused);
    this.progress.set(0);
    this.loadQueue = this.loadQueue
      .catch(error => this.showError(error, 'switch queue'))
      .then(async () => {
        if (generation !== this.loadGeneration || this.destroying) return;
        await this.releaseCurrent();
        if (generation !== this.loadGeneration || this.destroying) return;
        await this.load(next, generation);
      });
  }

  async ngOnInit() {

    // try {
    //   // preload audio file
    //   await this.preloadAudio();
    // } catch (error: any) {
    //   this.showError(error, 'ngOnInit()');
    // }

  }

  async ngOnDestroy() {
    this.destroying = true;
    ++this.loadGeneration;
    await this.loadQueue.catch(() => {});
    await this.releaseCurrent();
    this._androidEventsSubs.unsubscribe();
  }

  /**
   * Preload audio file
   */
  private async load(rec: Recording, generation: number) {
    try {
      if ((rec.duration || 0) <= 0) {
        const info = await AudioPlayer.getAudioFileDuration({ fileUri: rec.audioUri });
        if (generation !== this.loadGeneration || this.destroying) return;
        rec.duration = info.duration / 1000;
        await this.recordingsService.save();
      }
      if (generation !== this.loadGeneration || this.destroying) return;
      this.duration.set(rec.duration || 0);

      // Register before native prepare: playerReady may arrive before
      // AudioPlayer.load() resolves on a fast device.
      this.removePlayerReadyListener = (await AudioPlayer.addListener('playerReady', () => {
        if (generation !== this.loadGeneration || this.destroying) return;
        this.loadedRecording = rec;
        this.status.set(PlayerStatusEnum.Paused);
        this.progress.set(0);
        this.ready.set(true);
        this.cdr.markForCheck();
      })).remove;

      this.removePlayCompletedListener = (await AudioPlayer.addListener('playerCompleted', () => {
        if (generation !== this.loadGeneration || this.destroying) return;
        this.status.set(PlayerStatusEnum.Paused);
        this.progress.set(0);
        this.cdr.markForCheck();
      })).remove;

      this.removePlayerUpdateListener = (await AudioPlayer.addListener('playerUpdate', data => {
        if (generation !== this.loadGeneration || this.destroying) return;
        this.progress.set(Math.floor(data.position / 1000));
      })).remove;

      if (generation !== this.loadGeneration || this.destroying) return;
      this.nativeLoadAttempted = true;
      await AudioPlayer.load({
        fileUri: rec.audioUri,
        notificationTitle: rec.opName,
        enableEarpiece: this.settings.enableEarpiece,
        keepAwakeWhenPlaying: this.settings.keepAwakeWhenPlaying,
      });
      // The native service restores playback speed on STATE_READY.
    } catch (error) {
      if (generation === this.loadGeneration && !this.destroying) {
        this.ready.set(false);
        this.loadedRecording = undefined;
        this.showError(error, 'load()');
      }
    }
  }

  private async releaseCurrent() {
    this.ready.set(false);
    this.loadedRecording = undefined;
    this.status.set(PlayerStatusEnum.Paused);
    this.progress.set(0);
    this.duration.set(0);

    const onReady = this.removePlayerReadyListener;
    const onCompleted = this.removePlayCompletedListener;
    const onUpdate = this.removePlayerUpdateListener;
    this.removePlayerReadyListener = undefined;
    this.removePlayCompletedListener = undefined;
    this.removePlayerUpdateListener = undefined;
    await Promise.allSettled([onReady?.(), onCompleted?.(), onUpdate?.()]);
    // A fresh component has no native session to unload. This also avoids
    // dispatching an unload before the Android service binding is available.
    const shouldUnloadNative = this.nativeLoadAttempted;
    this.nativeLoadAttempted = false;
    if (shouldUnloadNative) await AudioPlayer.unload();
    if (!this.destroying) this.cdr.markForCheck();
  }

  /** Explicit release also cancels an older queued recording request. */
  public async unload() {
    const generation = ++this.loadGeneration;
    this.ready.set(false);
    this.loadedRecording = undefined;
    this.loadQueue = this.loadQueue.catch(() => {}).then(async () => {
      if (generation === this.loadGeneration) await this.releaseCurrent();
    });
    await this.loadQueue;
  }

  /**
   * Test if the player is ready to play
   */
  public isReady() { return this.ready(); }
  /** Loading the previous file never counts as readiness for a newly selected one. */
  public isReadyFor(recording: Recording) {
    return this.ready() && this.loadedRecording === recording;
  }
  public isPlaying() { return this.status() === PlayerStatusEnum.Playing; }
  /** Read-only progress for the compact controller; no second playback timer. */
  public readonly currentPosition = this.progress.asReadonly();
  public readonly totalDuration = this.duration.asReadonly();

  /**
   * Show error alert
   */
  private showError(error: any, context: string) {
    this.mbs.showError({
      error: error,
      appErrorCode: 'ERR_PLAYER',
      appErrorArgs: { context: context },
    });
  }

  /**
   * Toggle between play and pause
   */
  public async togglePlayPause() {
    if (this.status() === PlayerStatusEnum.Paused) {
      return this.play();
    }
    else {
      return this.pause();
    }
  }

  /**
   * Play the given record file (already loaded with load())
   */
  async play() {
    if (!this.ready() || !this.loadedRecording) return;
    return AudioPlayer.play()
      .then(async _ => {
        this.status.set(PlayerStatusEnum.Playing);
      })
      .catch(error => this.showError(error, 'play()'));
  }

  /**
   * Fast forward / rewind
   */
  protected async onSeek(mode: SeekMode) {
    let pos: number = 0;
    switch (mode) {
      case 'begin':
        pos = 0;
        break;
      case 'rew':
        pos = this.progress() - this.settings.seekTime;
        break;
      case 'fwd':
        pos = this.progress() + this.settings.seekTime;
        break;
    }
    return this.setCurrentPosition(pos);
  }

  /**
   * Toggle player speed
   */
  public async toggleSpeed() {
    switch (this.settings.playbackSpeed) {
      case 1:
        this.settings.playbackSpeed = 1.5;
        break;
      case 1.5:
        this.settings.playbackSpeed = 2;
        break;
      case 2:
        this.settings.playbackSpeed = 1;
        break;
    }
    await AudioPlayer.setPlaybackSpeed({ playbackSpeed: this.settings.playbackSpeed });
    await this.settings.save();
  }

  /**
   * Set position
   */
  protected async setCurrentPosition(position: number) {
    return this.seekTo(position);
  }

  /** Shared seek implementation for the original player and the inline row. */
  public async seekTo(position: number) {
    if (!Number.isFinite(position) || !this.ready()) return;
    const clamped = Math.max(0, Math.min(position, this.duration()));
    try {
      await AudioPlayer.setCurrentPosition({ position: clamped * 1000 });
      this.progress.set(clamped);
      this.cdr.markForCheck();
    } catch (error) {
      this.showError(error, 'seekTo()');
    }
  }

  /**
   * Pause the playing media file
   */
  async pause() {
    if (!this.ready() || this.status() !== PlayerStatusEnum.Playing) {
      return;
    }

    // pause audio
    await AudioPlayer.pause()
      .then(_ => {
        this.status.set(PlayerStatusEnum.Paused);
      })
      .catch(error => this.showError(error, 'pause()'));
  }

  /**
   * User released the position knob
   */
  protected async onIonKnobMoveStart(ev: Event) {
    this.isDraggingKnob.set(true);
  }

  /**
   * User is dragging the knob
   */
  protected rangePinFormatter(value: number) {
    return toHms(value);
  }

  /**
   * User released the position knob
   */
  protected async onIonKnobMoveEnd(ev: Event) {
    const newPos = (ev as RangeCustomEvent).detail.value as number;
    this.isDraggingKnob.set(false);
    this.setCurrentPosition(newPos);
    this.progress.set(newPos);
  }

}
