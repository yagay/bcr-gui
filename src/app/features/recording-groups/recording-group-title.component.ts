import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { Recording } from 'src/app/models/recording';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-recording-group-title',
  standalone: true,
  imports: [IonicBundleModule],
  templateUrl: './recording-group-title.component.html',
  styleUrls: ['./recording-group-title.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordingGroupTitleComponent {
  @Input({ required: true }) recording!: Recording;
  @Input({ required: true }) isHeader!: boolean;
  @Input({ required: true }) groupCount!: number;
  @Input({ required: true }) expanded!: boolean;
  @Input({ required: true }) selected!: boolean;
  @Input() multiselect = false;
  @Input() groupSelected = false;
  @Input() groupPartial = false;
  @Output() selectGroup = new EventEmitter<void>();
  @Output() expandRequested = new EventEmitter<void>();

  @Output() playRecording = new EventEmitter<Recording>();
}
