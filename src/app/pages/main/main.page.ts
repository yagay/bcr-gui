import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AudioPlayerComponent, SkipDirection } from '@app/components/audio-player/audio-player.component';
import { CallIconComponent } from '@app/components/call-icon/call-icon.component';
import { ActionButton, HeaderComponent } from '@app/components/header/header.component';
import { VirtualScrollbarComponent } from '@app/components/virtual-scrollbar/virtual-scrollbar.component';
import { LongPressDirective } from '@app/directives/long-press.directive';
import { Recording } from '@app/models/recording';
import { DatetimePipe } from '@app/pipes/datetime.pipe';
import { toHms, ToHmsPipe } from '@app/pipes/to-hms.pipe';
import { TranslatePipe } from '@app/pipes/translate.pipe';
import { ContactsService } from '@app/services/contacts.service';
import { I18nService } from '@app/services/i18n.service';
import { MessageBoxService } from '@app/services/message-box.service';
import { RecordingsService } from '@app/services/recordings.service';
import { DirectionFilter, RecordingListStore } from '@app/services/recording-list.store';
import { SettingsService } from '@app/services/settings.service';
import { getE164Number } from '@app/utils/phoneNumbers';
import { untilTrue } from '@app/utils/waitForAsync';
import { Clipboard } from '@capacitor/clipboard';
import { ActionSheetController, IonButton, IonButtons, IonContent, IonFooter, IonIcon, IonList, IonLoading, IonRefresher, IonRefresherContent, IonSearchbar, IonToolbar, RefresherCustomEvent } from '@ionic/angular';
import { AndroidSAF } from '@plugins/androidsaf';
import { ErrorCode } from '@plugins/bcrgui';
import version from '../../version';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AudioPlayerComponent,
    CallIconComponent,
    DatetimePipe,
    FormsModule,
    HeaderComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonIcon,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonToolbar,
    LongPressDirective,
    ScrollingModule,
    ToHmsPipe,
    TranslatePipe,
    VirtualScrollbarComponent,
    IonLoading,
  ],
  providers: [
    DatetimePipe,
    RecordingListStore,
  ],
})
export class MainPage implements AfterViewInit {

  protected version = version;
  protected listStore = inject(RecordingListStore);
  protected isMultiselect = this.listStore.isMultiselect;
  protected isSearch = signal(false);
  protected searchValue = this.listStore.searchValue;
  protected directionFilter = this.listStore.directionFilter;
  protected directionFilters: { value: DirectionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'in', label: 'Incoming' },
    { value: 'out', label: 'Outgoing' },
    { value: 'unknown', label: 'Other' },
  ];
  actionButtons: ActionButton[] = [
    {
      icon: () => this.searchValue() ? 'search-circle' : 'search-circle-outline',
      visible: () => !this.isMultiselect(),
      onClick: () => this.toggleSearchBar(),
    },
  ];
  selectedItem = signal<Recording | undefined>(undefined);
  private playRequest = 0;
  // show a progress for long actions
  protected progressMessage = signal<string|undefined>(undefined);

  // Filtering and batch selection are managed independently of playback.
  protected items = this.listStore.items;

  protected topIndex = 0; // index of top shown recording
  protected itemHeight = 78;
  protected itemGap = 12;

  private player = viewChild(AudioPlayerComponent);
  private scrollViewport = viewChild(CdkVirtualScrollViewport);
  private searchBar = viewChild(IonSearchbar);

  private asc = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);
  private contactsService = inject(ContactsService);
  private datePipe = inject(DatetimePipe);
  private i18n = inject(I18nService);
  private mbs = inject(MessageBoxService);
  protected recordingsService = inject(RecordingsService);
  protected settings = inject(SettingsService);

  // constructor() {
  //   // DEBUG: automatically select first recording
  //   if (!environment.production) {
  //     effect(() => {
  //       if (this.items()?.length) {
  //         setTimeout(() => this.onItemClick(this.items()[0]), 250);
  //       }
  //     });
  //   }
  // }

  async ionViewWillEnter() {

    // save reference to myself
    this.recordingsService.mainPageRef = this;

  }

  /**
   * Handle the VIEW intent request
   */
  async playIntentFile(viewIntentFilename: string, forceListRefresh = false) {

    // wait for refresh completion
    if (forceListRefresh) {
      await this.refreshList();
    }

    // wait for already running refresh
    // the await above could exit immediately if a refresh was already running
    await untilTrue(() => this.recordingsService.refreshProgress() === undefined);

    this.clearFilter();
    this.listStore.clearSelection();

    // find the required filename
    const playItemIx = this.items().findIndex(i => i.audioUri === viewIntentFilename);
    if (playItemIx >= 0) {

      const playItem = this.items()[playItemIx];

      // ensure it's visible
      this.scrollViewport()?.scrollToIndex(playItemIx);

      // select & play it (need to wait for player initialization)
      this.selectedItem.set(playItem);
      this.cdr.detectChanges();
      await untilTrue(() => this.player()?.recording() === playItem && this.player()!.isReady());
      this.player()?.play();

    }
    else if (!forceListRefresh) {
      // retry forcing list refresh
      await this.playIntentFile(viewIntentFilename, true);
    }
    else {
      // error
      this.mbs.showError({
        appErrorCode: 'ERR_OS006',
        appErrorArgs: {
          appname: 'BCR-GUI',
          filename: viewIntentFilename,
        },
      });
    }

  }

  /**
   * Stop the player before leaving the page
   */
  async ionViewWillLeave() {
    // clear reference to myself
    this.recordingsService.mainPageRef = undefined;

    await this.stopPlayer();
    // this._subs.unsubscribe();
  }

  async ngAfterViewInit() {
    await this.recordingsService.initialize();
  }

  async refreshList(event?: RefresherCustomEvent) {
    this.clearSelection();
    try {
      await this.recordingsService.refreshContent();
    } finally {
      await event?.target.complete();
    }
  }

  clearSelection() {
    this.listStore.clearSelection();
  }

  getSelectedItems(): Recording[] {
    return this.listStore.getSelectedItems();
  }

  protected isSelected(item: Recording) {
    return this.listStore.isSelected(item);
  }

  protected setDirectionFilter(value: DirectionFilter) {
    this.directionFilter.set(value);
    this.scrollViewport()?.scrollToIndex(0);
  }

  /**
   * Show/hide the searchbar and set focus to search field
   */
  toggleSearchBar() {
    this.isSearch.update(v => !v);
    if (this.isSearch()) {
      setTimeout(() => this.searchBar?.()?.setFocus(), 50);
    }
  }

  clearFilter() {
    this.listStore.clearFilter();
    this.isSearch.set(false);
    // this.updateFilter();
  }

  /**
   * Change selected status
   */
  async onItemClick(item: Recording) {
    if (this.isMultiselect()) {
      this.listStore.toggle(item);
      return;
    }
    this.selectedItem.set(item);
  }

  /** Play button changes the active audio without entering batch selection. */
  async playRecording(item: Recording, event?: Event) {
    event?.stopPropagation();
    if (this.isMultiselect()) {
      this.listStore.toggle(item);
      return;
    }
    const request = ++this.playRequest;
    this.selectedItem.set(item);
    this.cdr.detectChanges();
    try {
      await untilTrue(() => this.player()?.recording() === item && !!this.player()?.isReady(), 100, 10000);
      if (request === this.playRequest && this.selectedItem() === item) await this.player()?.play();
    } catch (error) {
      if (request === this.playRequest) console.error('Recording failed to become ready', error);
    }
  }

  /** Single contextual action sheet, rather than actions spread through the row. */
  async showRecordingActions(item: Recording, event?: Event) {
    event?.stopPropagation();
    const sheet = await this.asc.create({
      header: item.opName,
      buttons: [
        { text: this.i18n.get('HOME_EDIT_TITLE'), icon: 'pencil', handler: () => { void this.editItem(item); } },
        { text: this.i18n.get('HOME_EDIT_COPYNUMBER'), icon: 'copy-outline', handler: () => { void Clipboard.write({ string: item.opNumber }); } },
        { text: 'Share', icon: 'share-social', handler: () => { void this.shareRecording(item); } },
        { text: this.i18n.get('LBL_DELETE'), icon: 'trash', role: 'destructive', handler: () => { void this.deleteItems([item]); } },
        { text: 'Cancel', icon: 'close', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  /**
   * Deletes the given recording file (and its companion JSON metadata)
   */
  async deleteItems(items: Recording[]) {

    this.player()?.pause();

    // show confirmation alert
    await this.mbs.showConfirm({
      header: this.i18n.get('HOME_DELETE_CONFIRM_TITLE'),
      message: this.i18n.get('HOME_DELETE_CONFIRM_TEXT', items.length),
      confirmText: this.i18n.get('LBL_DELETE'),
      onConfirm: async () => {
        // forcibly unload audio
        const deletingActive = items.some(i => i.audioUri === this.selectedItem()?.audioUri);
        if (deletingActive) {
          ++this.playRequest;
          this.selectedItem.set(undefined);
        }
        await this.player()?.unload();
        this.progressMessage.set(`0 / ${items.length}`);
        await this.recordingsService.deleteRecording(items, (deleted, total) => {
          this.progressMessage.set(`${deleted} / ${total}`);
        });
        this.progressMessage.set(undefined);
        this.clearSelection();
      }
    });

  }

  /**
   * Edit the given item
   */
  async editItem(rec: Recording) {

    // stop player
    await this.player()?.pause();

    // show sheet modal
    const sheet = await this.asc.create({
      header: this.i18n.get('HOME_EDIT_TITLE'),
      cssClass: 'actions edit-actions',
      buttons: [
        {
          text: this.i18n.get('HOME_EDIT_NAME'),
          icon: 'pencil',
          handler: async () => await this.editItem_Edit(rec),
        },
        {
          text: this.i18n.get('HOME_EDIT_COPYNUMBER'),
          icon: 'copy-outline',
          handler: async () => await Clipboard.write({ string: rec.opNumber }),
        },
        {
          text: this.i18n.get('HOME_EDIT_ADDEDIT'),
          icon: '/assets/icons/contacts-add.svg',
          handler: async () => await this.editItem_AddEditContact(rec),
        },
        {
          text: this.i18n.get('HOME_EDIT_SEARCHCONTACT'),
          icon: '/assets/icons/contacts-search.svg',
          handler: async () => await this.editItem_SearchContacts(rec),
        },
      ]
    });
    await sheet.present();

  }

  /**
   * Allow user to insert a custom name for this recording
   */
  private async editItem_Edit(rec: Recording) {

    await this.mbs.showInputBox({
      header: this.i18n.get('HOME_EDIT_NAME'),
      message: this.i18n.get('HOME_EDIT_NAME_PLACEHOLDER'),
      inputs: [
        { name: 'contactName', placeholder: this.i18n.get('LBL_CONTACT_NAME'), value: rec.opName },
        { name: 'phoneNumber', value: rec.opNumber, disabled: true },
      ],
      onConfirm: async (data) => {
        rec.opName = data?.contactName?.length ? data.contactName : rec.opNumber;
        await this.recordingsService.save();
      }
    });

  }

  /**
   * Search contacts for an item with the same phone number as the given recording
   */
  private async editItem_SearchContacts(rec: Recording) {

    // check Contacts permission
    if (await this.contactsService.checkPermission() !== 'granted') return;

    // find contact with that phone number
    const e164Number = await getE164Number(rec.opNumber);
    const contact = (await this.contactsService.getPhoneNumbersMap())[e164Number];
    const displayName = contact?.displayName;

    // contact found?
    if (displayName) {
      // show confirm
      await this.mbs.showConfirm({
        header: this.i18n.get('HOME_EDIT_SEARCHCONTACT_FOUND_TITLE'),
        message: this.i18n.get('HOME_EDIT_SEARCHCONTACT_SET_TO_ALL', { displayName: `<strong>${displayName}</strong>` }),
        onConfirm: async () => {
          await this.recordingsService.setNameByNumber(rec.opNumber, displayName);
        }
      });
    }
    else {
      // show failure message
      await this.mbs.showConfirm({
        header: this.i18n.get('HOME_EDIT_SEARCHCONTACT_NOT_FOUND_TITLE'),
        message: this.i18n.get('HOME_EDIT_SEARCHCONTACT_NOT_FOUND_TEXT'),
        confirmText: this.i18n.get('HOME_EDIT_SEARCHCONTACT_CREATE'),
        onConfirm: async () => {
          await this.editItem_AddEditContact(rec);
        }
      });

    }

  }

  private async editItem_AddEditContact(rec: Recording) {

    // check Contacts permission
    if (await this.contactsService.checkPermission() !== 'granted') return;

    // open the default "add or edit" contact selector
    this.contactsService.createOrEditContact({
      displayName: rec.opName,
      phoneNumber: rec.opNumber
    })
    .then(async res => {

      // a new contact has been created (or an existing one was modified)
      console.log(`Created/edited contact: '${res.displayName}`);

      await this.mbs.showConfirm({
        header: this.i18n.get('HOME_EDIT_SEARCHCONTACT_FOUND_TITLE'),
        message: this.i18n.get('HOME_EDIT_SEARCHCONTACT_SET_TO_ALL', { displayName: res.displayName }),
        onConfirm: async () => {
          await this.recordingsService.setNameByNumber(rec.opNumber, res.displayName);
        }
      });

    })
    .catch(err => {
      // error ERR_USER_CANCELED is returned when user exits the contact editor without saving, we can just ignore it
      if (err.code !== ErrorCode.ERR_USER_CANCELED) {
        this.mbs.showError({
          error: err,
        });
      }
    });

  ;

  }

  /**
   * Select all items
   */
  async selectAll() {
    this.listStore.selectAll();
  }

  /**
   * Show Android share dialog to share an audio file
   */
  async shareRecording(item: Recording, event?: Event) {

    // stop player
    await this.stopPlayer();

    // open default Android share dialog
    try {
      await AndroidSAF.shareFile({
        uri: item.audioUri,
        text: this.getShareText(item),
      });
      console.log("Completed");
    }
    catch (error: any) {
      this.mbs.showError({
        appErrorCode: 'ERR_OS003',
        error: error,
      });
    }

  }

  /**
   * Return a string description of a recording, used when sharing file.
   */
  private getShareText(item: Recording) {

    return `
${item.opName}
Date: ${this.datePipe.transform(item.date)}
Duration: ${toHms(item.duration)}
`.trim();

  }

  /**
   * Start multiselection and select the given item
   */
  protected startMultiselection(item?: Recording) {
    this.listStore.startMultiselection(item);
  }

  /**
   * Default list scroll
   */
  onScroll(index: number) {
    this.topIndex = index;
  }

  /**
   * Stop player (if it exists)
   */
  private async stopPlayer() {
    await this.player()?.pause();
  }

  /**
   * Skip to previous/next item
   */
  protected onSkip(direction: SkipDirection) {
    // find first selected item index
    const selectedItemIndex = this.items().findIndex(i => i.audioUri === this.selectedItem()?.audioUri);
    if (selectedItemIndex >= 0) {
      const newSelectedItem = this.items()[selectedItemIndex + (direction === 'next' ? +1 : -1)];
      if (newSelectedItem) {
        void this.playRecording(newSelectedItem);
      }
    }
  }

  protected trackByUri(idx: number, item: Recording) {
    return item.audioUri;
  }

}
