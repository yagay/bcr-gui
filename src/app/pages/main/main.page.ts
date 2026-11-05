import { AudioPlayerComponent, SkipDirection } from 'src/app/components/audio-player/audio-player.component';
import { ActionButton, HeaderComponent } from 'src/app/components/header/header.component';
import { VirtualScrollbarComponent } from 'src/app/components/virtual-scrollbar/virtual-scrollbar.component';
import { RecordingGroupsService } from 'src/app/features/recording-groups/recording-groups.service';
import { HistoryRecordingRowComponent } from 'src/app/features/recording-groups/history-recording-row.component';
import { HistoryControlsComponent } from 'src/app/features/recording-groups/history-controls.component';
import { HistoryDetailsComponent } from 'src/app/features/recording-groups/history-details.component';
import { HistoryInlinePlayerComponent } from 'src/app/features/recording-groups/history-inline-player.component';
import { IonicBundleModule } from 'src/app/IonicBundle.module';
import { Recording } from 'src/app/models/recording';
import { DatetimePipe } from 'src/app/pipes/datetime.pipe';
import { FilesizePipe } from 'src/app/pipes/filesize.pipe';
import { ToHmsPipe } from 'src/app/pipes/to-hms.pipe';
import { ContactsService } from 'src/app/services/contacts.service';
import { I18nService } from 'src/app/services/i18n.service';
import { MessageBoxService } from 'src/app/services/message-box.service';
import { RecordingsService } from 'src/app/services/recordings.service';
import { SettingsService } from 'src/app/services/settings.service';
import { buildRecordingHistory, projectRecordingHistory, historyConsistency, filterRecordingDirection, HistoryFilter } from 'src/app/features/recording-groups/recording-history.model';
import { SortModeEnum } from 'src/app/utils/recordings-sorter';
import { buildDisplayRows, HistoryDisplayRow, actionRecords, selectionState, setGroupSelection, invertRecordingSelection, inlineRowOnScreen } from 'src/app/features/recording-groups/history-display-rows';
import { untilTrue } from 'src/app/utils/waitForAsync';
import { AndroidSAF } from 'src/plugins/androidsaf';
import { ErrorCode } from 'src/plugins/bcrgui';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import { ActionSheetController, RefresherCustomEvent } from '@ionic/angular';
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
    HeaderComponent,
    IonicBundleModule,
    HistoryRecordingRowComponent,
    HistoryControlsComponent,
    HistoryDetailsComponent,
    HistoryInlinePlayerComponent,
    ScrollingModule,
    ToHmsPipe,
    VirtualScrollbarComponent,
  ],
  providers: [
    ContactsService,
    DatePipe,
    RecordingGroupsService,
    ToHmsPipe,
  ],
})
export class MainPage implements AfterViewInit, OnDestroy {

  protected version = version;
  protected isMultiselect = signal(false);
  protected searchValue = signal('');
  protected showAllRecordings = signal(false);
  protected directionFilter = signal<HistoryFilter>('all');
  private playRequestId = 0;
  private viewportResizeObserver?: ResizeObserver;
  private resizeFrame = 0;
  private viewportScrollFrame = 0;
  private scrollOffsetPx = signal(0);
  private viewportHeightPx = signal(0);
  // Restore the original header search affordance while keeping new filters below.
  protected actionButtons: ActionButton[] = [{
    icon: () => this.searchValue() ? 'search-circle' : 'search-circle-outline',
    visible: () => !this.isMultiselect(),
    onClick: () => this.historyControls()?.toggleSearch(),
  }];
  selectedItem = signal<Recording | undefined>(undefined);
  protected recordingGroups = inject(RecordingGroupsService);
  protected expandedGroupKey = this.recordingGroups.expandedGroupKey;

  // Filtered and sorted recordings before the collapsed contact view is applied.
  // Playback, multiselection and intent handling must keep using the full list.
  private sortedItems = computed<Recording[]>(() => {
    const sortedItems = buildRecordingHistory(
      filterRecordingDirection(this.recordingsService.recordings(), this.directionFilter()),
      this.searchValue(),
      this.sortMode(),
    );

    return sortedItems;
  });

  // Group metadata is derived without writing to another signal from a computed().
  protected groups = computed(() => this.recordingGroups.buildGroups(
    this.sortedItems(),
    this.settings.defaultCountryPrefix,
    this.sortMode(),
  ));

  // filtered and grouped items collection
  protected items = computed(() => this.showAllRecordings()
    ? this.sortedItems()
    : projectRecordingHistory(
      this.groups(), this.recordingGroups, this.sortMode(),
      this.settings.defaultCountryPrefix,
    ));
  // The source count is intentionally independent of the expanded/collapsed
  // CDK rows. Grouping must never change the number of indexed recordings.
  protected displayRows = computed(() => buildDisplayRows(
    this.items(),
    this.isMultiselect() ? undefined : this.selectedItem()?.audioUri,
  ));
  protected displayCount = computed(() => this.displayRows().length);
  protected indexedCount = computed(() => this.recordingsService.recordings().length);
  private selectedUris = signal<ReadonlySet<string>>(new Set());
  protected selectedCount = computed(() => this.sortedItems().filter(item => this.selectedUris().has(item.audioUri)).length);
  protected initializing = signal(true);
  protected scrubbing = signal(false);
  protected scrubPosition = signal(0);
  protected sortMode = signal<SortModeEnum>(this.settings.recordingsSortMode);
  protected isRefreshing = computed(() => this.recordingsService.refreshProgress() !== undefined);
  protected visibleCount = computed(() => this.items().length);
  protected groupCount = computed(() => this.groups().size);
  protected historyIntegrity = computed(() => historyConsistency(this.sortedItems(), this.groups()));
  protected setSortMode(mode: SortModeEnum): void {
    if (this.sortMode() === mode) return;
    this.resetListInteraction();
    this.sortMode.set(mode);
    this.settings.recordingsSortMode = mode;
    void this.settings.save();
    this.scrollViewport()?.scrollToIndex(0);
    this.remeasureViewport();
  }

  protected trackByDisplayRow(_index: number, entry: HistoryDisplayRow): string {
    return entry.key;
  }

  protected inlineProgress(): number { return this.scrubbing() ? this.scrubPosition() : (this.player()?.currentPosition() ?? 0); }
  protected inlineDuration(): number { return this.player()?.totalDuration() ?? this.selectedItem()?.duration ?? 0; }
  protected inlinePlaying(): boolean { return this.player()?.playingState() === true; }
  protected inlineReady(): boolean { return this.selectedItem() !== undefined && this.player()?.isReadyFor(this.selectedItem()!) === true; }
  protected inlineFailed(): boolean { return this.player()?.failedState() === true; }
  protected previewSeek(position: number): void {
    if (Number.isFinite(position)) {
      this.scrubbing.set(true);
      this.scrubPosition.set(position);
    }
  }

  protected seekInline(position: number): void {
    if (Number.isFinite(position)) void this.player()?.seekTo(position);
    this.scrubbing.set(false);
  }

  protected seekRelative(direction: -1 | 1): void {
    if (!this.inlineReady()) return;
    const target = (this.player()?.currentPosition() ?? 0) + direction * this.settings.seekTime;
    void this.player()?.seekTo(target);
  }

  protected canSkip(direction: SkipDirection): boolean {
    // The previous button also rewinds the current track after 3 seconds.
    if (direction === 'prev' && (this.player()?.currentPosition() ?? 0) >= 3) return true;
    const index = this.sortedItems().findIndex(record => record === this.selectedItem());
    const target = index + (direction === 'next' ? 1 : -1);
    return index >= 0 && target >= 0 && target < this.sortedItems().length;
  }

  // When a playing child recording is folded away, keep its controls reachable.
  protected inlinePlayerVisible(): boolean {
    return inlineRowOnScreen(
      this.displayRows(),
      this.selectedItem()?.audioUri,
      this.scrollOffsetPx(),
      this.viewportHeightPx(),
      this.itemHeight,
    );
  }
  protected toggleInline(): void {
    const item = this.selectedItem();
    if (item) void this.selectAndPlay(item);
  }
  protected switchPlaybackSpeed(): void { void this.player()?.toggleSpeed(); }
  protected playbackSpeed(): number { return this.settings.playbackSpeed; }
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

  protected toggleGroup(item: Recording): void {
    if (this.showAllRecordings() || this.isMultiselect()) return;
    // Only affect the presentation. Do not deselect, pause or unload the
    // recording currently playing within a collapsed contact group.
    this.recordingGroups.toggle(item, this.settings.defaultCountryPrefix);
    this.remeasureViewport();
  }

  protected isRowPlaying(item: Recording): boolean {
    return this.selectedItem() === item && this.player()?.playingState() === true;
  }

  protected onPlayRow(item: Recording) {
    if (this.isMultiselect()) {
      this.onRowClick(item);
      return;
    }
    // Playing the group's representative recording must not silently
    // expand its history. Only the chevron or main row tap controls expansion.
    const header = !this.showAllRecordings() && this.isGroupHeader(item) && this.getGroupCount(item) > 1;
    void this.selectAndPlay(item, !header);
  }

  /**
   * The latest requested recording wins. A native player is shared across
   * every row; never try to play while the previous file is still loaded.
   */
  private async selectAndPlay(item: Recording, expandGroup = true): Promise<void> {
    if (this.selectedItem() === item && this.player()?.isReadyFor(item)) {
      ++this.playRequestId;
      await this.player()?.togglePlayPause();
      this.focusRecording(item);
      return;
    }
    const request = ++this.playRequestId;
    const retry = this.selectedItem() === item && this.player()?.failedState() === true;
    this.selectRecording(item, expandGroup);
    this.cdr.detectChanges();
    if (retry) this.player()?.retryFailed();
    this.focusRecording(item);
    this.remeasureViewport();
    try {
      await untilTrue(
        () => request !== this.playRequestId ||
          (this.selectedItem() === item && (this.player()?.isReadyFor(item) === true ||
            this.player()?.failedState() === true)),
        75, 12000,
      );
      if (request === this.playRequestId && this.selectedItem() === item &&
          this.player()?.isReadyFor(item)) {
        await this.player()?.play();
      }
    } catch {
      if (request === this.playRequestId && this.selectedItem() === item) {
        this.player()?.markReadyTimeout(item);
        this.mbs.showError({ error: new Error('Playback preparation timed out. Tap retry to load this recording again.') });
      }
    }
  }

  /** Navigate the actual CDK source rows, not the collapsed group count. */
  private focusRecording(item: Recording): void {
    requestAnimationFrame(() => {
      if (this.selectedItem()?.audioUri !== item.audioUri) return;
      const index = this.displayRows().findIndex(row =>
        row.kind === 'recording' && row.recording.audioUri === item.audioUri);
      if (index < 0) return;
      const viewport = this.scrollViewport();
      viewport?.checkViewportSize();
      viewport?.scrollToIndex(Math.max(0, index - 1), 'smooth');
      this.onViewportScroll();
    });
  }

  private selectRecording(item: Recording, expandGroup = true): void {
    this.selectedUris.set(new Set());
    if (expandGroup && !this.showAllRecordings()) {
      this.recordingGroups.expand(item, this.settings.defaultCountryPrefix);
    }
    this.selectedItem.set(item);
    this.scrubbing.set(false);
    this.isMultiselect.set(false);
    this.cdr.markForCheck();
  }

  private groupActionRecords(item: Recording): Recording[] {
    return actionRecords(
      item,
      this.showAllRecordings() || this.isGroupHeader(item),
      !this.showAllRecordings(),
      this.groups().get(this.getGroupKey(item)) ?? [item],
    );
  }

  protected rowSelected(item: Recording): boolean {
    if (!this.isMultiselect()) return this.selectedItem() === item;
    return selectionState(this.groupActionRecords(item), this.selectedUris()) === 'all';
  }

  protected rowPartSelected(item: Recording): boolean {
    return this.isMultiselect() &&
      selectionState(this.groupActionRecords(item), this.selectedUris()) === 'partial';
  }

  protected onRowClick(item: Recording) {
    if (this.isMultiselect()) {
      this.selectedUris.update(old => setGroupSelection(old, this.groupActionRecords(item)));
      this.cdr.markForCheck();
      return;
    }
    if (!this.showAllRecordings() && this.isGroupHeader(item) && this.getGroupCount(item) > 1) {
      // Original contact-row behavior: expand and select the latest file.
      // Its chevron remains expand-only and its play button remains play-only.
      const same = this.selectedItem()?.audioUri === item.audioUri;
      const expanded = this.expandedGroupKey() === this.getGroupKey(item);
      if (same && expanded) {
        this.recordingGroups.toggle(item, this.settings.defaultCountryPrefix);
        this.clearSelection();
      } else {
        ++this.playRequestId;
        this.selectRecording(item);
        this.cdr.detectChanges();
        this.remeasureViewport();
      }
      return;
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
  private historyControls = viewChild(HistoryControlsComponent);

  constructor(
    private asc: ActionSheetController,
    private cdr: ChangeDetectorRef,
    private contactsService: ContactsService,
    private datePipe: DatePipe,
    protected i18n: I18nService,
    private mbs: MessageBoxService,
    private toHms: ToHmsPipe,
    protected recordingsService: RecordingsService,
    protected router: Router,
    protected settings: SettingsService,
  ) {
    // An initial SAF index is populated after the viewport first renders.
    // Recalculate CDK's rendered range when recording/group counts change,
    // not only when a recording gets selected and the player is mounted.
    effect(() => {
      this.displayRows().length;
      untracked(() => this.remeasureViewport());
    });
  }

  async ionViewWillEnter() {
    this.sortMode.set(this.settings.recordingsSortMode);

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
      this.scrollViewport()?.scrollToIndex(playItemIx >= 0 ? this.displayRows().findIndex(row => row.key === playItem.audioUri) : 0);

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
    // Begin observing before SAF indexing: the first Ionic page layout can
    // complete before the recording index finishes loading.
    const viewport = this.scrollViewport()?.elementRef.nativeElement;
    if (viewport && typeof ResizeObserver !== 'undefined') {
      this.viewportResizeObserver = new ResizeObserver(() => this.remeasureViewport());
      this.viewportResizeObserver.observe(viewport);
      const parent = viewport.parentElement;
      if (parent) this.viewportResizeObserver.observe(parent);
    }
    this.remeasureViewport();
    try {
      await this.recordingsService.initialize();
    } finally {
      this.initializing.set(false);
      this.cdr.markForCheck();
      this.remeasureViewport();
    }
  }

  async ionViewDidEnter() {
    this.remeasureViewport();
  }

  ngOnDestroy(): void {
    this.viewportResizeObserver?.disconnect();
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    if (this.viewportScrollFrame) cancelAnimationFrame(this.viewportScrollFrame);
  }

  private remeasureViewport(): void {
    // Coalesce Ionic transitions, initial SAF refresh and row changes into
    // one measurement per frame. Never scroll or change row geometry here.
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      const viewport = this.scrollViewport();
      viewport?.checkViewportSize();
      this.viewportHeightPx.set(viewport?.getViewportSize() ?? 0);
      this.scrollOffsetPx.set(viewport?.measureScrollOffset('top') ?? 0);
    });
  }

  protected onViewportScroll(): void {
    if (this.viewportScrollFrame) return;
    this.viewportScrollFrame = requestAnimationFrame(() => {
      this.viewportScrollFrame = 0;
      const viewport = this.scrollViewport();
      this.viewportHeightPx.set(viewport?.getViewportSize() ?? 0);
      this.scrollOffsetPx.set(viewport?.measureScrollOffset('top') ?? 0);
    });
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
    this.selectedUris.set(new Set());
    this.selectedItem.set(undefined);
    this.scrubbing.set(false);
    this.isMultiselect.set(false);
    this.cdr.markForCheck();
    this.remeasureViewport();
  }

  getSelectedItems(): Recording[] {
    return this.sortedItems().filter(r => this.selectedUris().has(r.audioUri));
  }

  protected setSearch(value: string): void {
    if (this.searchValue() === value) return;
    this.resetListInteraction();
    this.searchValue.set(value);
    this.scrollViewport()?.scrollToIndex(0);
    this.remeasureViewport();
  }

  protected resetFilters(): void {
    this.resetListInteraction();
    this.searchValue.set('');
    this.directionFilter.set('all');
    this.scrollViewport()?.scrollToIndex(0);
    this.remeasureViewport();
  }

  clearFilter(): void {
    this.searchValue.set('');
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
    // Group headers and virtualized children represent the same full source.
    this.clearSelection();
    this.isMultiselect.set(true);
    this.selectedUris.set(new Set(this.sortedItems().map(item => item.audioUri)));
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
    // Original long-press starts with the touched recording only; tapping
    // a group header while in multi-select can still select its whole group.
    this.selectedUris.set(new Set(item ? [item.audioUri] : []));
    this.cdr.markForCheck();
  }

  protected invertSelection(): void {
    if (!this.isMultiselect()) return;
    this.selectedUris.update(old => invertRecordingSelection(old, this.sortedItems()));
    this.cdr.markForCheck();
  }

  protected deselectAll(): void {
    this.selectedUris.set(new Set());
    this.cdr.markForCheck();
  }

  /**
   * Default list scroll
   */
  onScroll(index: number) {
    this.topIndex = index;
    this.onViewportScroll();
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
    // Like a media player, previous resets after 3 seconds; otherwise skip.
    if (direction === 'prev' && (this.player()?.currentPosition() ?? 0) >= 3) {
      void this.player()?.seekTo(0);
      return;
    }
    // Navigate the complete filtered history, never only collapsed summaries.
    const selectedItemIndex = this.sortedItems().findIndex(i => i === this.selectedItem());
    if (selectedItemIndex >= 0) {
      const newSelectedItem = this.sortedItems()[selectedItemIndex + (direction === 'next' ? +1 : -1)];
      if (newSelectedItem) {
        void this.selectAndPlay(newSelectedItem);
      }
    }
  }


}
