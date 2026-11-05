import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from 'src/app/services/i18n.service';
import { Recording } from 'src/app/models/recording';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';

/** Fixed-height inline detail section following the selected recording in CDK. */
@Component({
  selector: 'app-history-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicBundleModule, DatetimePipe, FilesizePipe],
  template: `
    <section class="details" [attr.aria-label]="i18n.get('HOME_EDIT_TITLE')">
      <div class="title-row">
        <strong>{{ recording().opName || recording().opNumber || i18n.get('HISTORY_UNKNOWN') }}</strong>
        <button class="close-button" type="button" (click)="close.emit()"
          [attr.aria-label]="i18n.get('HISTORY_CLOSE_DETAILS')">×</button>
      </div>
      <div class="metadata">
        @if (recording().opNumber) {
          <span class="phone-line">
            <strong>{{ i18n.get('HOME_REC_PHONE_NUMBER') }}:</strong>
            @if (dialUri()) {
              <a [href]="dialUri()">{{ recording().opNumber }}</a>
            } @else {
              <span>{{ recording().opNumber }}</span>
            }
          </span>
        }
        <span>{{ recording().date | datetime }}</span>
        <span><strong>{{ i18n.get('HOME_REC_TYPE') }}:</strong> {{ recording().mimeType }}</span>
        <span><strong>{{ i18n.get('HOME_REC_SIZE') }}:</strong> {{ recording().filesize | filesize }}</span>
      </div>
      <div class="actions">
        @if (dialUri()) {
          <a [href]="dialUri()" class="action" [attr.aria-label]="i18n.get('HISTORY_CALL')">
            <ion-icon name="call-outline" />{{ i18n.get('HISTORY_CALL') }}
          </a>
        }
        <button type="button" class="action" (click)="edit.emit()">
          <ion-icon name="pencil-outline" />{{ i18n.get('LBL_EDIT') }}
        </button>
        <button type="button" class="action" (click)="share.emit()">
          <ion-icon name="share-outline" />{{ i18n.get('HISTORY_SHARE') }}
        </button>
        <button type="button" class="action" (click)="delete.emit()">
          <ion-icon name="trash-outline" />{{ i18n.get('LBL_DELETE') }}
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host {display:block;min-width:0;box-sizing:border-box;overflow:hidden;}
    .details {height:calc(100% - 4px);box-sizing:border-box;overflow-y:auto;
      margin:0 12px 4px;padding:10px 14px;box-shadow:0 2px 5px -3px rgba(40,40,40,.2);
      background:var(--ion-color-step-50);border:1px solid var(--ion-color-step-200);
      border-top:0;border-radius:0 0 10px 10px;}
    .title-row {display:flex;align-items:center;gap:8px;justify-content:space-between;}
    .title-row strong {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;}
    .close-button {border:0;background:transparent;color:var(--ion-color-step-650);font-size:23px;padding:0 5px;}
    .metadata {display:flex;gap:6px 12px;flex-wrap:wrap;color:var(--ion-color-step-650);
      margin-top:4px;font-size:11px;}
    .phone-line {display:flex;gap:5px;flex:1 0 100%;align-items:center;min-width:0;flex-wrap:wrap;}
    .phone-line a {color:var(--ion-color-primary);text-decoration:none;overflow-wrap:anywhere;}
    .actions {display:flex;align-items:center;justify-content:flex-end;
      gap:6px;overflow-x:auto;margin-top:10px;padding-block:3px;}
    .action {display:inline-flex;align-items:center;justify-content:center;gap:5px;
      flex:1 0 auto;padding:7px 10px;border:1px solid var(--ion-color-step-200);
      border-radius:8px;background:var(--ion-background-color);color:var(--ion-color-primary);
      font-size:12px;text-decoration:none;white-space:nowrap;}
    .action ion-icon {font-size:17px;}
    .action {min-height:40px;box-sizing:border-box;}
    @media(max-width:360px) {
      .details {margin-inline:7px;padding-inline:10px;}
      .actions {gap:4px;}
      .action {padding-inline:7px;font-size:11px;}
    }
  `]
})
export class HistoryDetailsComponent {
  readonly recording = input.required<Recording>();
  protected readonly i18n = inject(I18nService);
  readonly dialUri = input<string | null>(null);
  readonly close = output<void>();
  readonly edit = output<void>();
  readonly share = output<void>();
  readonly delete = output<void>();
}
