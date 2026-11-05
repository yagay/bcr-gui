import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { Recording } from 'src/app/models/recording';
import { CallIconComponent } from 'src/app/components/call-icon/call-icon.component';
import { RecordingGroupTitleComponent } from './recording-group-title.component';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { LongPressDirective } from 'src/app/directives/long-press.directive';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';

/**
 * Original BCR-GUI ion-card DOM and interaction styling.
 * Data is supplied by the new indexed/filtered history projection.
 */
@Component({
  selector: 'app-history-recording-row',
  standalone: true,
  imports: [IonicBundleModule, CallIconComponent, RecordingGroupTitleComponent,
    DatetimePipe, ToHmsPipe, FilesizePipe, LongPressDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-card class="item" [class.selected]="selected()" [class.child-item]="!isHeader()"
      [class.multiselect]="multiselect()">
      <ion-card-header (click)="onOpen()" longPress (longPress)="onLongPress()">
        <app-recording-group-title [recording]="recording()"
          [isHeader]="isHeader()" [groupCount]="groupCount()" [expanded]="expanded()"
          [selected]="selected()" [multiselect]="multiselect()"
          [groupSelected]="groupSelected()" [groupPartial]="partial()"
          (playRecording)="playClicked.emit()"
          (expandRequested)="expandedClicked.emit()"
          (selectGroup)="groupSelectClicked.emit()" />
        <ion-card-subtitle class="left-container subtitle">
          <app-call-icon class="call-direction-icon" [direction]="recording().direction ?? ''" />
          <span>{{ recording().date | datetime }}</span>
          @if (recording().duration) {
            • <span>{{ recording().duration | toHms }}</span>
          }
        </ion-card-subtitle>
      </ion-card-header>
      @if (!multiselect() && selected()) {
        <ion-card-content class="content">
          <div class="details-actions">
            <div class="details">
              @if (recording().opNumber) {
                <p>
                  {{ 'HOME_REC_PHONE_NUMBER' | translatePipe }}:
                  @if (dialUri()) {
                    <a class="phone-link" [href]="dialUri()"
                      (click)="$event.stopPropagation()">{{ recording().opNumber }}</a>
                  } @else {
                    {{ recording().opNumber }}
                  }
                </p>
              }
              <p>{{ 'HOME_REC_TYPE' | translatePipe }}: {{ recording().mimeType }}</p>
              <p>{{ 'HOME_REC_SIZE' | translatePipe }}: {{ recording().filesize | filesize }}</p>
            </div>
            <div class="actions">
              <ion-icon name="pencil" class="action"
                (click)="edit.emit(); $event.stopPropagation()" />
              <ion-icon name="share-social" class="action"
                (click)="share.emit(); $event.stopPropagation()" />
              <ion-icon name="trash" class="action"
                (click)="delete.emit(); $event.stopPropagation()" />
            </div>
          </div>
        </ion-card-content>
      }
    </ion-card>
  `,
  styles: [`
    :host {display:block;min-width:0;box-sizing:border-box;contain:layout paint size;}
    .item {
      height:calc(100% - 12px); min-height:0; margin:6px 0;
      border-radius:10px;
      box-shadow:0 5px 7px -1px rgba(51,51,51,.23);
      overflow:hidden;
      transition:border-color .2s ease-in-out,background-color .2s ease-in-out,
        box-shadow .2s ease-in-out;
    }
    ion-card-header {cursor:pointer;padding:10px 16px;gap:5px;}
    .item.child-item {
      margin-left:2em;
      border-left:3px solid var(--ion-color-step-300);
      background-color:var(--ion-color-step-50);
      box-shadow:0 2px 4px -1px rgba(51,51,51,.1);
    }
    .item.child-item ion-card-header {padding:8px 12px;gap:0;}
    .item.child-item .subtitle {min-height:28px;align-items:center;line-height:20px;}
    .item.selected {
      border:2px solid var(--item-border-color-selected);
      background-color:var(--ion-item-background-selected);
      box-shadow:0 0 4px 1px var(--item-border-color-selected);
      border-radius:10px;
    }
    .item.selected.child-item ion-card-header {padding:12px;}
    .content {display:flex;flex-direction:column;gap:1em;overflow:auto;max-height:140px;}
    .details-actions {display:flex;justify-content:space-between;gap:10px;}
    .details {min-width:0;overflow-wrap:anywhere;font-size:13px;}
    .details p {margin:0 0 9px;}
    .phone-link {color:var(--ion-color-primary);text-decoration:underline;text-underline-offset:2px;}
    .actions {align-self:end;display:flex;gap:1.25em;justify-content:flex-end;
      color:var(--ion-color-step-600);}
    .actions .action {font-size:2em;line-height:2em;cursor:pointer;}
    .subtitle {color:RGB(var(--ion-text-color-rgb));display:flex;flex-wrap:wrap;gap:.5em;}
    .call-direction-icon {height:.7rem;width:.7rem;}
    @media(max-width:355px) {
      ion-card-header {padding-inline:11px;}
      .details-actions {flex-direction:column;}
      .actions {align-self:flex-end;}
    }
  `],
})
export class HistoryRecordingRowComponent {
  readonly recording = input.required<Recording>();
  readonly isHeader = input(true);
  readonly groupCount = input(1);
  readonly expanded = input(false);
  readonly selected = input(false);
  readonly partial = input(false);
  readonly groupSelected = input(false);
  readonly playing = input(false);
  readonly multiselect = input(false);
  readonly dialUri = input<string | null>(null);
  readonly opened = output<void>();
  readonly playClicked = output<void>();
  readonly expandedClicked = output<void>();
  readonly groupSelectClicked = output<void>();
  readonly longPressed = output<void>();
  readonly edit = output<void>();
  readonly share = output<void>();
  readonly delete = output<void>();
  private suppressClick = false;
  protected onLongPress(): void {
    this.suppressClick = true;
    this.longPressed.emit();
    setTimeout(() => this.suppressClick = false, 550);
  }
  protected onOpen(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.opened.emit();
  }
}
