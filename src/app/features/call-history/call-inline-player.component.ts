import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { RangeCustomEvent } from '@ionic/angular';

/**
 * Fixed-height inline controller below the active call row.
 *
 * All audio state belongs to the persistent AudioPlayerComponent in MainPage:
 * this component only reflects it and emits user actions. Safe to destroy when
 * the call row scrolls out of CDK's virtual viewport.
 */
@Component({
  selector: 'app-call-inline-player',
  standalone: true,
  templateUrl: './call-inline-player.component.html',
  styleUrls: ['./call-inline-player.component.scss'],
  imports: [IonicBundleModule, ToHmsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallInlinePlayerComponent {
  readonly currentPosition = input(0);
  readonly duration = input(0);
  readonly ready = input(false);
  readonly playing = input(false);
  readonly speed = input(1);

  readonly playPause = output<void>();
  readonly close = output<void>();
  readonly changeSpeed = output<void>();
  readonly seek = output<number>();

  protected dragging = signal(false);
  protected dragPosition = signal(0);

  protected onDragStart() {
    this.dragPosition.set(this.currentPosition());
    this.dragging.set(true);
  }

  protected onDrag(event: Event) {
    const value = (event as RangeCustomEvent).detail.value;
    if (typeof value === 'number') this.dragPosition.set(value);
  }

  protected onDragEnd(event: Event) {
    const value = (event as RangeCustomEvent).detail.value;
    this.dragging.set(false);
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.seek.emit(Math.max(0, Math.min(value, this.duration())));
    }
  }

  protected jump(seconds: number) {
    this.seek.emit(Math.max(0, Math.min(this.duration(), this.currentPosition() + seconds)));
  }
}
