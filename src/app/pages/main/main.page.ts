import { AudioPlayerComponent, SkipDirection } from 'src/app/components/audio-player/audio-player.component';
import { ActionButton, HeaderComponent } from 'src/app/components/header/header.component';
import { VirtualScrollbarComponent } from 'src/app/components/virtual-scrollbar/virtual-scrollbar.component';
import { RecordingGroupsService } from 'src/app/features/recording-groups/recording-groups.service';
import { HistoryRecordingRowComponent } from 'src/app/features/recording-groups/history-recording-row.component';
import { HistoryControlsComponent } from 'src/app/features/recording-groups/history-controls.component';
import { HistoryDetailsComponent } from 'src/app/features/recording-groups/history-details.component';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { Recording } from 'src/app/models/recording';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { ContactsService } from 'src/app/services/contacts.service';
import { I18nService } from 'src/app/services/i18n.service';
import { MessageBoxService } from 'src/app/services/message-box.service';
import { RecordingsService } from 'src/app/services/recordings.service';
import { SettingsService } from 'src/app/services/settings.service';
import { buildRecordingHistory, projectRecordingHistory, historyConsistency, filterRecordingDirection, HistoryFilter } from 'src/app/features/recording-groups/recording-history.model';
import { sortRecordings } from 'src/app/utils/recordings-sorter';
import { untilTrue } from 'src/app/utils/waitForAsync';
import { AndroidSAF } from 'src/plugins/androidsaf';
import { ErrorCode } from 'src/plugins/bcrgui';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import { ActionSheetController, IonSearchbar, RefresherCustomEvent } from '@ionic/angular';
import version from '../../version';

@Component({
  selector: 'app-main',
  standalone: true,
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AudioPlayerComponent,
    DatetimePipe,
    FilesizePipe,
    FormsModule,
    HeaderComponent,
    IonicBundleModule,
    HistoryRecordingRowComponent,
    HistoryControlsComponent,
    HistoryDetailsComponent,
    ScrollingModule,
    ToHmsPipe,
    TranslatePipe,
    VirtualScrollbarComponent,
  ],
  providers: [
    ContactsService,
    DatePipe,
    RecordingGroupsService,
    ToHmsPipe,
  ],
})
export class MainPage implements AfterViewInit {

  protected version = version;
  protected isMultiselect = signal(false);
  protected isSearch = signal(false);
  protected searchValue = signal('');
  protected isZh = /^zh\b/i.test(navigator.language);
  protected showAllRecordings = signal(false);
  protected directionFilter = signal<HistoryFilter>('all');
  private playRequestId = 0;
  actionButtons: ActionButton[] = [
    {
      icon: () => this.searchValue() ? 'search-circle' : 'search-circle-outline',
      visible: () => !this.isMultiselect(),
      onClick: () => this.toggleSearchBar(),
    },
  ];
  selectedItem = signal<Recording | undefined>(undefined);
  protected recordingGroups = inject(RecordingGroupsService);
  protected expandedGroupKey = this.recordingGroups.expandedGroupKey;

  // Filtered and sorted recordings before the collapsed contact view is applied.
  // Playback, multiselection and intent handling must keep using the full list.
  private sortedItems = computed<Recording[]>(() => {
    const sortedItems = buildRecordingHistory(
      filterRecordingDirection(this.recordingsService.recordings(), this.directionFilter()),
      this.searchValue(),
      this.settings.recordingsSortMode,
    );

    return sortedItems;
  });

  // Group metadata is derived without writing to another signal from a computed().
  protected groups = computed(() => this.recordingGroups.buildGroups(
    this.sortedItems(),
    this.settings.defaultCountryPrefix,
    this.settings.recordingsSortMode,
  ));

  // filtered and grouped items collection
  protected items = computed(() => this.showAllRecordings()
    ? this.sortedItems()
    : projectRecordingHistory(
      this.groups(), this.recordingGroups, this.settings.recordingsSortMode,
      this.settings.defaultCountryPrefix,
    ));
  // The source count is intentionally independent of the expanded/collapsed
  // CDK rows. Grouping must never change the number of indexed recordings.
  protected indexedCount = computed(() => this.recordingsService.recordings().length);
  protected selectedCount = signal(0);
  protected isRefreshing = computed(() => this.recordingsService.refreshProgress() !== undefined);
  protected visibleCount = computed(() => this.items().length);
  protected groupCount = computed(() => this.groups().size);
  protected historyIntegrity = computed(() => historyConsistency(this.sortedItems(), this.groups()));
  protected setDirectionFilter(value: HistoryFilter): void {
    if (this.directionFilter() === value) return;
    this.resetListInteraction();
    this.directionFilter.set(value);
    this.scrollViewport()?.scrollToIndex(0);
    this.remeasureViewport();
  }

  private resetListInteraction(): void {
    this.clearSelection();
    this.recordingGroups.expandedGroupKey.set(undefined);
  }

  protected refreshFromToolbar(): void {
    void this.refreshList();
  }

  protected toggleViewMode() {
    this.resetListInteraction();
    this.showAllRecordings.update(v => !v);
    this.scrollViewport()?.scrollToIndex(0);
    this.remeasureViewport();
  }

  protected toggleGroup(item: Recording) {
    if (this.showAllRecordings()) return;
    this.recordingGroups.toggle(item, this.settings.defaultCountryPrefix);
    this.remeasureViewport();
  }

  protected isRowPlaying(item: Recording): boolean {
    return this.selectedItem() === item && this.player()?.isPlaying() === true;
  }

  protected onPlayRow(item: Recording) {
    if (this.isMultiselect()) return;
    void this.selectAndPlay(item);
  }

  /**
   * The latest requested recording wins. A native player is shared across
   * every row; never try to play while the previous file is still loaded.
   */
  private async selectAndPlay(item: Recording): Promise<void> {
    if (this.selectedItem() === item && this.player()?.isReadyFor(item)) {
      ++this.playRequestId;
      await this.player()?.togglePlayPause();
      return;
    }
    const request = ++this.playRequestId;
    this.selectRecording(item);
    this.cdr.detectChanges();
    this.remeasureViewport();
    try {
      await untilTrue(
        () => request !== this.playRequestId ||
          (this.selectedItem() === item && this.player()?.isReadyFor(item) === true),
        75, 12000,
      );
      if (request === this.playRequestId && this.selectedItem() === item) {
        await this.player()?.play();
      }
    } catch (error) {
      if (request === this.playRequestId && this.selectedItem() === item) {
        this.mbs.showError({ error });
      }
    }
  }

  private selectRecording(item: Recording): void {
    this.recordingsService.recordings().forEach(r => r.selected = false);
    item.selected = true;
    this.selectedItem.set(item);
    this.isMultiselect.set(false);
    this.selectedCount.set(0);
    this.cdr.markForCheck();
  }

  protected onRowClick(item: Recording) {
    if (this.isMultiselect()) {
      item.selected = !item.selected;
      this.updateSelectedCount();
      if (!this.selectedCount()) this.isMultiselect.set(false);
      this.cdr.markForCheck();
      return;
    }
    if (!this.showAllRecordings() && this.isGroupHeader(item) && this.getGroupCount(item) > 1) {
      this.toggleGroup(item);
    }
    if (this.selectedItem() === item) {
      this.clearSelection();
    } else {
      ++this.playRequestId;
      this.selectRecording(item);
      this.cdr.detectChanges();
      this.remeasureViewport();
    }
  }


  protected topIndex = 0; // index of top shown recording
  protected itemHeight = 78;
  protected itemGap = 0;

  private player = viewChild(AudioPlayerComponent);
  private scrollViewport = viewChild(CdkVirtualScrollViewport);
  private searchBar = viewChild(IonSearchbar);

  constructor(
    private asc: ActionSheetController,
    private cdr: ChangeDetectorRef,
    private contactsService: ContactsService,
    private datePipe: DatePipe,
    private i18n: I18nService,
    private mbs: MessageBoxService,
    private toHms: ToHmsPipe,
    protected recordingsService: RecordingsService,
    protected router: Router,
    protected settings: SettingsService,
  ) {

    // // DEBUG: automatically select first recording
    // if (!environment.production) {
    //   effect(() => {
    //     if (this.items()?.length) {
    //       setTimeout(() => this.onItemClick(this.items()[0]), 250);
    //     }
    //   });
    // }

  }

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
    this.directionFilter.set('all');
    this.clearSelection();

    // Find the requested file in the full list and expand its contact first. An
    // older recording is intentionally absent from the collapsed display list.
    const playItem = this.sortedItems().find(i => i.audioUri === viewIntentFilename);
    if (playItem) {
      if (!this.showAllRecordings()) this.recordingGroups.expand(playItem, this.settings.defaultCountryPrefix);
      const playItemIx = this.items().findIndex(i => i === playItem);

      // ensure it's visible
      this.scrollViewport()?.scrollToIndex(playItemIx);

      await this.selectAndPlay(playItem);

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
    this.recordingsService.mainPageRef = undefined;
    ++this.playRequestId;
    await this.stopPlayer();
    // this._subs.unsubscribe();
  }

  async ngAfterViewInit() {
    await this.recordingsService.initialize();
    // Data arrives asynchronously after SAF scan: let CDK recalculate the
    // viewport without changing its fixed itemSize or replacing DOM siblings.
    this.remeasureViewport();
  }

  async ionViewDidEnter() {
    this.remeasureViewport();
  }

  private remeasureViewport(): void {
    requestAnimationFrame(() => this.scrollViewport()?.checkViewportSize());
  }

  private updateSelectedCount(): void {
    this.selectedCount.set(this.recordingsService.recordings().filter(r => !!r.selected).length);
  }

  async refreshList(event?: RefresherCustomEvent) {
    this.clearSelection();
    try {
      await this.recordingsService.refreshContent();
    } finally {
      await event?.target.complete();
      this.remeasureViewport();
    }
  }

  clearSelection() {
    ++this.playRequestId;
    this.recordingsService.recordings().forEach(r => r.selected = false);
    this.selectedItem.set(undefined);
    this.selectedCount.set(0);
    this.isMultiselect.set(false);
    this.cdr.markForCheck();
    this.remeasureViewport();
  }

  getSelectedItems(): Recording[] {
    return this.sortedItems().filter(r => r.selected);
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
    this.searchValue.set('');
    this.isSearch.set(false);
    // this.updateFilter();
  }

  /**
   * Helper to check if a recording is the header of its group
   */
  protected isGroupHeader(item: Recording): boolean {
    return this.recordingGroups.isGroupHeader(item, this.groups(), this.settings.defaultCountryPrefix);
  }

  protected getGroupCount(item: Recording): number {
    return this.recordingGroups.getGroupCount(item, this.groups(), this.settings.defaultCountryPrefix);
  }

  protected isDialableNumber(item: Recording): boolean {
    return this.recordingGroups.isDialable(item);
  }

  protected getDialUri(item: Recording): string {
    return this.recordingGroups.getDialUri(item);
  }

  protected getGroupKey(item: Recording): string {
    return this.recordingGroups.getGroupKey(item, this.settings.defaultCountryPrefix);
  }

  /**
   * Change selected status
   */
  async onItemClick(item: Recording) {
    await this.selectAndPlay(item);
  }

  /**
   * Deletes the given recording file (and its companion JSON metadata)
   */
  async deleteItems(items: Recording[]) {
    if (!items.length) return;
    await this.player()?.pause();

    // show confirmation alert
    await this.mbs.showConfirm({
      header: this.i18n.get('HOME_DELETE_CONFIRM_TITLE'),
      message: this.i18n.get('HOME_DELETE_CONFIRM_TEXT', items.length),
      confirmText: this.i18n.get('LBL_DELETE'),
      onConfirm: async () => {
        // forcibly unload audio
        await this.player()?.unload();
        await this.recordingsService.deleteRecording(items);
        this.clearSelection();
        this.remeasureViewport();
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
    const pnm = await this.contactsService.getPhoneNumbersMap();
    const displayName = pnm.getDisplayName(rec.opNumber);

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
    // In collapsed mode this still selects ALL matching source recordings.
    this.clearSelection();
    this.isMultiselect.set(true);
    this.sortedItems().forEach(i => i.selected = true);
    this.updateSelectedCount();
    this.cdr.markForCheck();
  }

  /**
   * Show Android share dialog to share an audio file
   */
  async shareRecording(item: Recording, _event?: MouseEvent) {

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
Date: ${this.datePipe.transform(item.date, 'medium')}
Duration: ${this.toHms.transform(item.duration)}
`.trim();

  }

  /**
   * Start multiselection and select the given item
   */
  protected startMultiselection(item?: Recording) {
    if (this.isMultiselect()) return;
    this.clearSelection();
    this.isMultiselect.set(true);
    if (item) item.selected = true;
    this.updateSelectedCount();
    this.cdr.markForCheck();
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
    // Navigate the complete filtered history, never only collapsed summaries.
    const selectedItemIndex = this.sortedItems().findIndex(i => i === this.selectedItem());
    if (selectedItemIndex >= 0) {
      const newSelectedItem = this.sortedItems()[selectedItemIndex + (direction === 'next' ? +1 : -1)];
      if (newSelectedItem) {
        if (!this.showAllRecordings()) this.recordingGroups.expand(newSelectedItem, this.settings.defaultCountryPrefix);
        void this.selectAndPlay(newSelectedItem);
      }
    }
  }

  protected trackByUri(idx: number, item: Recording) {
    return item.audioUri;
  }

}
