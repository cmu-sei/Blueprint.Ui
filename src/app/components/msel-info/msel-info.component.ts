// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserQuery } from 'src/app/data/user/user.query';
import {
  DataField,
  MselItemStatus,
  MselPage,
  MselUnit,
  ScenarioEvent,
  SystemPermission,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatMenuTrigger } from '@angular/material/menu';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { CiteService } from 'src/app/generated/blueprint.api';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { ScoringModel } from 'src/app/generated/blueprint.api/model/scoringModel';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { MselUnitQuery } from 'src/app/data/msel-unit/msel-unit.query';
import { AngularEditorConfig } from '@kolkov/angular-editor';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-msel-info',
  templateUrl: './msel-info.component.html',
  styleUrls: ['./msel-info.component.scss'],
  standalone: false
})
export class MselInfoComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Output() deleteThisMsel = new EventEmitter<string>();
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  isChanged = false;
  userList: User[] = [];
  teamList: Team[] = [];
  mselUnitList: MselUnit[] = [];
  scoringModelList: ScoringModel[] = [];
  itemStatus: MselItemStatus[] = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Deployed,
    MselItemStatus.Complete,
    MselItemStatus.Archived,
  ];
  viewUrl: string;
  starterUrl: string;
  mselPages: MselPage[] = [];
  newMselPage = {} as MselPage;
  changedMselPage = {} as MselPage;
  currentTabIndex = 0;
  editingPageId = '';
  private newlyAddedPageName = '';
  // Map to store unsaved changes for each page
  private unsavedPageChanges = new Map<string, MselPage>();
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: 'p',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
    customClasses: [
      {
        name: 'Left Aligned',
        class: 'text-left',
        tag: 'p',
      }
    ]
  };
  viewConfig: AngularEditorConfig = {
    editable: false,
    height: 'auto',
    minHeight: '1200px',
    width: '100%',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: false,
    showToolbar: false,
    placeholder: '',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    sanitize: false,
  };
  isBusy = true;
  dataFieldList: DataField[] = [];
  basePageUrl = document.baseURI + '/mselpage/';
  pushStatus = '';
  savedStartTime: Date;
  savedDurationSeconds = 0;
  playerViewName = '';
  galleryCollectionName = '';
  galleryExhibitName = '';
  citeEvaluationName = '';
  citeScoringModelName = '';
  steamfitterScenarioName = '';
  constructor(
    public dialogService: DialogService,
    private teamQuery: TeamQuery,
    private userQuery: UserQuery,
    private dataFieldQuery: DataFieldQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private citeService: CiteService,
    private playerService: PlayerService,
    private mselPageDataService: MselPageDataService,
    private mselPageQuery: MselPageQuery,
    private mselUnitQuery: MselUnitQuery,
    private permissionDataService: PermissionDataService,
    private changeDetectorRef: ChangeDetectorRef,
    private settingsService: ComnSettingsService,
    private http: HttpClient
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          const isNewMselId = this.msel.id !== msel.id;
          Object.assign(this.originalMsel, msel);
          Object.assign(this.msel, msel);
          if (isNewMselId) {
            this.viewUrl = document.baseURI + 'msel/' + this.msel.id + '/view';
            this.starterUrl =
              document.baseURI + 'starter/?msel=' + this.msel.id;
            this.mselPageDataService.loadByMsel(msel.id);
            this.newMselPage.mselId = msel.id;
          }
          this.savedStartTime = new Date(msel.startTime);
          this.savedDurationSeconds = msel.durationSeconds;
          // Update scoring model name when scoring model ID changes
          this.updateCiteScoringModelName();
          // Fetch integration names for deployed integrations
          this.fetchIntegrationNames();
        }
      });
    // subscribe to MSEL loading flag
    this.mselQuery
      .selectLoading()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoading) => {
        this.isBusy = isLoading;
      });
    // subscribe to MSEL push statuses
    this.mselDataService.mselPushStatuses
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselPushStatuses) => {
        const mselPushStatus = mselPushStatuses.find(
          (mps) => mps.mselId === this.msel.id
        );
        if (mselPushStatus) {
          if (mselPushStatus.pushStatus) {
            this.pushStatus = mselPushStatus.pushStatus;
          } else {
            if (this.pushStatus) {
              this.pushStatus = '';
              // added this, because signalR is not updating the actual msel data during a push
              this.mselDataService.loadById(this.msel.id);
            }
          }
        }
      });
    // subscribe to users
    this.userQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // subscribe to teams
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => {
        this.teamList = teams;
      });
    // subscribe to mselUnits
    this.mselUnitQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselUnits) => {
        this.mselUnitList = mselUnits;
      });
    // subscribe to MselPages
    this.mselPageQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((pages) => {
        const previousLength = this.mselPages.length;
        const currentPageId = this.changedMselPage?.id;
        this.mselPages = pages;

        // If a new page was added, switch to it and start editing
        if (this.newlyAddedPageName && pages.length > previousLength) {
          const newPage = pages.find(p => p.name === this.newlyAddedPageName);
          if (newPage) {
            const newPageIndex = pages.findIndex(p => p.id === newPage.id);
            // Switch to the new page tab
            setTimeout(() => {
              this.currentTabIndex = newPageIndex + 1;
              // Make a copy so it's editable
              this.changedMselPage = { ...newPage };
              this.editingPageId = newPage.id;
            }, 100);
            this.newlyAddedPageName = '';
          }
        }
        // If we were on an existing page and not switching to a new one, keep the page updated
        else if (currentPageId && this.currentTabIndex > 0 && this.currentTabIndex <= pages.length && !this.newlyAddedPageName) {
          // Find the updated page object
          const updatedPage = pages.find(p => p.id === currentPageId);
          if (updatedPage) {
            this.changedMselPage = { ...updatedPage };
          }
        }
      });
    // subscribe to scoring models
    this.citeService.getScoringModels().subscribe(
      (scoringModels) => {
        console.log('CITE scoring models loaded:', scoringModels?.length || 0, 'models');
        // Filter out evaluation-specific scoring models (keep only templates with evaluationId == null)
        this.scoringModelList = (scoringModels || []).filter(sm => !sm.evaluationId);
        console.log('Filtered to', this.scoringModelList.length, 'template scoring models (excluded evaluation-specific copies)');
        if (this.scoringModelList.length === 0) {
          console.warn('CITE returned no template scoring models');
        }
        // Update the scoring model name after list is loaded
        this.updateCiteScoringModelName();
      },
      (error) => {
        console.error('Failed to load CITE scoring models:', error);
        this.scoringModelList = [];
      }
    );
    // subscribe to data fields
    this.dataFieldQuery.selectAll().subscribe((dataFields) => {
      this.dataFieldList = dataFields;
    });
  }

  ngOnInit() {
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
  }

  getUserName(userId: string) {
    const user = this.userList.find((u) => u.id === userId);
    return user ? user.name : 'unknown';
  }

  saveChanges() {
    this.mselDataService.updateMsel(this.msel);
    this.isChanged = false;
  }

  cancelChanges() {
    this.isChanged = false;
    Object.assign(this.msel, this.originalMsel);
  }

  deleteMsel() {
    if (this.canManageMsel()) {
      this.dialogService
        .confirm(
          'Delete MSEL',
          'Are you sure that you want to delete ' + this.msel.name + '?'
        )
        .subscribe((result) => {
          if (result['confirm']) {
            this.deleteThisMsel.emit(this.msel.id);
          }
        });
    }
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').editor;
  }

  canManageMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
  }

  galleryWarningMessage() {
    let warningMessage = '';
    if (this.msel.useGallery && !this.msel.galleryExhibitId) {
      warningMessage = this.galleryToDo()
        ? '** There are unassigned Gallery Article Parameters in Data Fields **'
        : '';
    }
    return warningMessage;
  }

  citeWarningMessage() {
    let warningMessage = '';
    if (this.msel.useCite && !this.msel.citeEvaluationId) {
      const teamsWithType = this.teamList.filter((t) => t.citeTeamTypeId);
      const teamsWithoutType = this.teamList.filter((t) => !t.citeTeamTypeId);

      if (teamsWithoutType.length > 0 && teamsWithType.length > 0) {
        // Some teams missing types - this blocks the push
        warningMessage = `** ERROR: ${teamsWithoutType.length} team(s) are missing a CITE Team Type. All teams must have a team type selected before pushing to CITE. **`;
      } else if (teamsWithoutType.length > 0 && teamsWithType.length === 0) {
        // No teams have types - warning only
        warningMessage = '** WARNING: No teams have a CITE Team Type selected, so no teams will be pushed to CITE! **';
      }
    }
    return warningMessage;
  }

  hasCiteTeamsWithoutType() {
    // Returns true if CITE is enabled and there are teams without a CITE team type
    // This blocks the push button similar to the scoring model requirement
    if (!this.msel.useCite || this.msel.citeEvaluationId) {
      return false; // CITE not enabled or already deployed, no validation needed
    }
    // Check if ANY teams exist without a citeTeamTypeId
    return this.teamList.some((t) => !t.citeTeamTypeId);
  }

  pushIntegrations() {
    this.dialogService
      .confirm(
        'Push Integrations',
        'Are you sure that you want to push MSEL data to the selected applications?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pushIntegrations(this.msel.id);
          this.pushStatus = 'Pushing Integrations';
        }
      });
  }

  pullIntegrations() {
    this.dialogService
      .confirm(
        'Remove Integrations',
        'Are you sure you want to remove this MSEL from the associated applications?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.pullIntegrations(this.msel.id);
        }
      });
  }

  onTabIndexChange(targetIndex: number) {
    // Don't do anything if we're already on this tab
    if (targetIndex === this.currentTabIndex) {
      return;
    }

    // Save current page's unsaved changes to the map if editing
    if (this.editingPageId && this.changedMselPage && this.changedMselPage.id) {
      this.unsavedPageChanges.set(this.editingPageId, { ...this.changedMselPage });
    }

    // Check if clicking on "Add Page" tab (last tab)
    if (targetIndex === this.mselPages.length + 1) {
      // Don't actually switch to the Add Page tab
      // Just create a new page and stay on current tab
      this.addNewPage();
      return;
    }

    // Perform the tab switch
    this.currentTabIndex = targetIndex;

    // Load the page for the new tab
    if (targetIndex > 0 && targetIndex <= this.mselPages.length) {
      const page = this.mselPages[targetIndex - 1];
      // Check if we have unsaved changes for this page
      if (this.unsavedPageChanges.has(page.id)) {
        // Load unsaved changes and set editing mode
        this.changedMselPage = { ...this.unsavedPageChanges.get(page.id) };
        this.editingPageId = page.id;
      } else {
        // Load the original page and clear editing mode
        this.changedMselPage = { ...page };
        this.editingPageId = '';
      }
    } else {
      this.changedMselPage = {} as MselPage;
      this.editingPageId = '';
    }
  }

  requestPageEdit(id: string) {
    // If we're already editing this page, do nothing
    if (this.editingPageId === id) {
      return;
    }

    // Save current page's unsaved changes if we're editing something else
    if (this.editingPageId && this.changedMselPage && this.changedMselPage.id) {
      this.unsavedPageChanges.set(this.editingPageId, { ...this.changedMselPage });
    }

    // Start editing the new page
    this.editingPageId = id;

    // Load unsaved changes if they exist, otherwise load the original page
    if (this.unsavedPageChanges.has(id)) {
      this.changedMselPage = { ...this.unsavedPageChanges.get(id) };
    } else {
      this.changedMselPage = { ...this.mselPages.find((p) => p.id === id) };
    }
  }

  addNewPage() {
    // Save current page's unsaved changes if we're editing
    if (this.editingPageId && this.changedMselPage && this.changedMselPage.id) {
      this.unsavedPageChanges.set(this.editingPageId, { ...this.changedMselPage });
    }

    // Create a unique name to avoid conflicts
    const existingNewPages = this.mselPages.filter(p => p.name.startsWith('New Page'));
    const pageNumber = existingNewPages.length > 0 ? existingNewPages.length + 1 : '';
    const pageName = pageNumber ? `New Page ${pageNumber}` : 'New Page';

    // Create a blank page immediately
    const newPage: MselPage = {
      mselId: this.originalMsel.id,
      name: pageName,
      content: '',
      allCanView: false
    } as MselPage;
    this.newlyAddedPageName = newPage.name;
    this.mselPageDataService.add(newPage);
  }

  saveMselPageEdits() {
    this.changedMselPage.mselId = this.originalMsel.id;
    const pageId = this.changedMselPage.id;
    // Store the current tab to restore it after save
    const currentTab = this.currentTabIndex;

    // Always updating an existing page now
    this.mselPageDataService.update(this.changedMselPage);

    // Clear the unsaved changes for this page
    if (pageId) {
      this.unsavedPageChanges.delete(pageId);
    }

    // Clear the editing state
    this.editingPageId = '';

    // Ensure we stay on the same tab
    setTimeout(() => {
      this.currentTabIndex = currentTab;
      // Reload the saved page
      if (currentTab > 0 && currentTab <= this.mselPages.length) {
        this.changedMselPage = { ...this.mselPages[currentTab - 1] };
      }
    }, 0);
  }

  cancelMselPageEdits() {
    // Clear unsaved changes for this page if it exists
    if (this.editingPageId) {
      this.unsavedPageChanges.delete(this.editingPageId);
      // Clear the editing state
      this.editingPageId = '';
    }

    // Reset changedMselPage to a fresh copy of the current page (original data)
    if (
      this.currentTabIndex > 0 &&
      this.currentTabIndex <= this.mselPages.length
    ) {
      this.changedMselPage = { ...this.mselPages[this.currentTabIndex - 1] };
    } else {
      this.changedMselPage = {} as MselPage;
    }
  }

  deletePage(page: MselPage): void {
    this.dialogService
      .confirm(
        'Delete Page',
        'Are you sure that you want to delete ' + page.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          // Clear any unsaved changes for this page
          this.unsavedPageChanges.delete(page.id);
          this.mselPageDataService.delete(page.id);
          // Switch back to Config tab after deletion
          this.currentTabIndex = 0;
        }
      });
  }

  openContent(id: string) {
    window.open(this.basePageUrl + id);
  }

  hasUnsavedPageChanges(): boolean {
    if (!this.editingPageId || !this.changedMselPage) {
      return false;
    }

    // Find the original page
    const originalPage = this.mselPages.find(p => p.id === this.editingPageId);
    if (!originalPage) {
      return false;
    }

    // Compare the changed page with the original
    return this.changedMselPage.name !== originalPage.name ||
           this.changedMselPage.content !== originalPage.content ||
           this.changedMselPage.allCanView !== originalPage.allCanView;
  }


  galleryToDo(): boolean {
    let hasToDos = false;
    let todoList = Object.assign([], this.msel.galleryArticleParameters);
    if (todoList && todoList.length > 0) {
      todoList = todoList.filter(
        (x) =>
          !this.dataFieldList.some((df) => df.galleryArticleParameter === x)
      );
      hasToDos = todoList.length > 0;
    }
    return hasToDos;
  }

  startTimeCheck() {
    if (
      this.msel.startTime.toLocaleString() !==
      this.savedStartTime.toLocaleString()
    ) {
      this.isChanged = true;
    }
  }

  hasStartTime(): boolean {
    return this.msel.startTime && this.msel.startTime.valueOf() > 0;
  }

  toggleStartTime(event: any) {
    this.msel.startTime = event.checked
      ? new Date()
      : new Date('0001-01-01T00:00:00');
    this.msel.startTime.setHours(8, 0, 0, 0);
    this.msel.startTime.setDate(this.msel.startTime.getDate() + 1);
    this.startTimeCheck();
  }

  updateCiteScoringModelName() {
    if (this.msel.citeScoringModelId && this.scoringModelList.length > 0) {
      const scoringModel = this.scoringModelList.find(sm => sm.id === this.msel.citeScoringModelId);
      this.citeScoringModelName = scoringModel ? scoringModel.description : '';
      if (!scoringModel) {
        console.warn(`Scoring Model ID ${this.msel.citeScoringModelId} not found in list of ${this.scoringModelList.length} scoring models`);
      }
    } else {
      this.citeScoringModelName = '';
      if (this.msel.citeScoringModelId && this.scoringModelList.length === 0) {
        console.warn(`Cannot update scoring model name - scoringModelList is empty but citeScoringModelId is ${this.msel.citeScoringModelId}`);
      }
    }
  }

  getPlayerViewUrl(): string {
    if (!this.msel.playerViewId) return '';
    let baseUrl = this.settingsService.settings.PlayerUrl || '';
    if (baseUrl && baseUrl.slice(-1) !== '/') {
      baseUrl = baseUrl + '/';
    }
    return `${baseUrl}view/${this.msel.playerViewId}`;
  }

  getGalleryExhibitUrl(): string {
    if (!this.msel.galleryExhibitId) return '';
    const baseUrl = this.settingsService.settings.GalleryUrl || '';
    return `${baseUrl}?exhibit=${this.msel.galleryExhibitId}`;
  }

  getCiteEvaluationUrl(): string {
    if (!this.msel.citeEvaluationId) return '';
    const baseUrl = this.settingsService.settings.CiteUrl || '';
    return `${baseUrl}?evaluation=${this.msel.citeEvaluationId}`;
  }

  getSteamfitterScenarioUrl(): string {
    if (!this.msel.steamfitterScenarioId) return '';
    let baseUrl = this.settingsService.settings.SteamfitterUrl || '';
    if (baseUrl && baseUrl.slice(-1) !== '/') {
      baseUrl = baseUrl + '/';
    }
    return `${baseUrl}scenario/${this.msel.steamfitterScenarioId}`;
  }

  fetchIntegrationNames() {
    // Fetch Player View name
    if (this.msel.playerViewId) {
      const playerApiUrl = this.settingsService.settings.PlayerApiUrl || '';
      this.http.get<any>(`${playerApiUrl}/views/${this.msel.playerViewId}`)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(
          (view) => {
            this.playerViewName = view.name || '';
          },
          (error) => {
            console.error('Failed to load Player View name:', error);
            this.playerViewName = '';
          }
        );
    } else {
      this.playerViewName = '';
    }

    // Fetch Gallery Collection name
    if (this.msel.galleryCollectionId) {
      const galleryApiUrl = this.settingsService.settings.GalleryApiUrl || '';
      this.http.get<any>(`${galleryApiUrl}/collections/${this.msel.galleryCollectionId}`)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(
          (collection) => {
            this.galleryCollectionName = collection.name || '';
          },
          (error) => {
            console.error('Failed to load Gallery Collection name:', error);
            this.galleryCollectionName = '';
          }
        );
    } else {
      this.galleryCollectionName = '';
    }

    // Fetch Gallery Exhibit name
    if (this.msel.galleryExhibitId) {
      const galleryApiUrl = this.settingsService.settings.GalleryApiUrl || '';
      this.http.get<any>(`${galleryApiUrl}/exhibits/${this.msel.galleryExhibitId}`)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(
          (exhibit) => {
            this.galleryExhibitName = exhibit.name || '';
          },
          (error) => {
            console.error('Failed to load Gallery Exhibit name:', error);
            this.galleryExhibitName = '';
          }
        );
    } else {
      this.galleryExhibitName = '';
    }

    // Fetch CITE Evaluation name
    if (this.msel.citeEvaluationId) {
      const citeApiUrl = this.settingsService.settings.CiteApiUrl || '';
      this.http.get<any>(`${citeApiUrl}/evaluations/${this.msel.citeEvaluationId}`)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(
          (evaluation) => {
            this.citeEvaluationName = evaluation.description || '';
          },
          (error) => {
            console.error('Failed to load CITE Evaluation name:', error);
            this.citeEvaluationName = '';
          }
        );
    } else {
      this.citeEvaluationName = '';
    }

    // Fetch Steamfitter Scenario name
    if (this.msel.steamfitterScenarioId) {
      const steamfitterApiUrl = this.settingsService.settings.SteamfitterApiUrl || '';
      this.http.get<any>(`${steamfitterApiUrl}/scenarios/${this.msel.steamfitterScenarioId}`)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(
          (scenario) => {
            this.steamfitterScenarioName = scenario.name || '';
          },
          (error) => {
            console.error('Failed to load Steamfitter Scenario name:', error);
            this.steamfitterScenarioName = '';
          }
        );
    } else {
      this.steamfitterScenarioName = '';
    }
  }

  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  getTimezoneAbbr(): string {
    const date = new Date();
    const timeZone = this.getUserTimezone();
    const formatted = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone
    });
    const parts = formatted.split(' ');
    return parts[parts.length - 1];
  }

  ngOnDestroy() {
    // Clear the unsaved changes map to prevent memory leaks
    this.unsavedPageChanges.clear();
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
