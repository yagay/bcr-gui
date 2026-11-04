import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Recording } from 'src/app/models/recording';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';

/** Fixed dock outside CDK: its height never changes a virtual recording row. */
@Component({
  selector: 'app-history-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicBundleModule, DatetimePipe, FilesizePipe],
  template: `
    <section class="details" [attr.aria-label]="zh() ? '录音详情' : 'Recording details'">
      <div class="title-row">
        <strong>{{ recording().opName || recording().opNumber || (zh() ? '未知号码' : 'Unknown') }}</strong>
        <button class="close-button" type="button" (click)="close.emit()"
          [attr.aria-label]="zh() ? '关闭详情' : 'Close details'">×</button>
      </div>
      <div class="metadata">
        <span>{{ recording().date | datetime }}</span>
        <span>{{ recording().mimeType }}</span>
        <span>{{ recording().filesize | filesize }}</span>
      </div>
      <div class="actions">
        @if (dialUri()) {
          <a [href]="dialUri()" class="action" [attr.aria-label]="zh() ? '拨号' : 'Call'">
            <ion-icon name="call-outline" />{{ zh() ? '拨号' : 'Call' }}
          </a>
        }
        <button type="button" class="action" (click)="edit.emit()">
          <ion-icon name="pencil-outline" />{{ zh() ? '编辑' : 'Edit' }}
        </button>
        <button type="button" class="action" (click)="share.emit()">
          <ion-icon name="share-outline" />{{ zh() ? '分享' : 'Share' }}
        </button>
        <button type="button" class="action" (click)="delete.emit()">
          <ion-icon name="trash-outline" />{{ zh() ? '删除' : 'Delete' }}
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block;flex:0 0 auto;min-width:0; }
    .details {background:var(--ion-color-step-50);padding:9px 14px;
      border-top:1px solid var(--ion-color-step-200);}
    .title-row {display:flex;align-items:center;gap:8px;justify-content:space-between;}
    .title-row strong {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;}
    .close-button {border:0;background:transparent;color:var(--ion-color-step-650);font-size:23px;padding:0 5px;}
    .metadata {display:flex;gap:6px 12px;flex-wrap:wrap;color:var(--ion-color-step-650);
      margin-top:4px;font-size:11px;}
    .actions {display:flex;align-items:center;gap:6px;overflow-x:auto;margin-top:8px;}
    .action {display:inline-flex;align-items:center;justify-content:center;gap:5px;
      flex:1 0 auto;padding:7px 10px;border:1px solid var(--ion-color-step-200);
      border-radius:8px;background:var(--ion-background-color);color:var(--ion-color-primary);
      font-size:12px;text-decoration:none;white-space:nowrap;}
    .action ion-icon {font-size:16px;}
  `]
})
export class HistoryDetailsComponent {
  readonly recording = input.required<Recording>();
  readonly zh = input(false);
  readonly dialUri = input<string | null>(null);
  readonly close = output<void>();
  readonly edit = output<void>();
  readonly share = output<void>();
  readonly delete = output<void>();
}
