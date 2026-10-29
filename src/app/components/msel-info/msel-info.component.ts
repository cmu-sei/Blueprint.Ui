// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject, input, output, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UserQuery } from 'src/app/data/user/user.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  Competency,
  DataField,
  MselCompetency,
  MselItemStatus,
  MselPage,
  MselScoringModel,
  MselScoringModelService,
  MselService,
  MselUnit,
  ScenarioEvent,
  SystemPermission,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { canUpdateMsel } from 'src/app/utilities/msel-permissions';
import { MselImageDataService } from 'src/app/data/msel/msel-image-data.service';
import { ErrorService } from 'src/app/services/error/error.service';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { CiteService } from 'src/app/generated/blueprint.api';
import { PlayerService } from 'src/app/generated/blueprint.api';
import { CasterService } from 'src/app/generated/blueprint.api';
import { CasterDirectory } from 'src/app/generated/blueprint.api/model/casterDirectory';
import { PlayerApplication } from 'src/app/generated/blueprint.api/model/playerApplication';
import { PlayerApplicationDataService } from 'src/app/data/player-application/player-application-data.service';
import { PlayerApplicationQuery } from 'src/app/data/player-application/player-application.query';
import { ScoringModel } from 'src/app/generated/blueprint.api/model/scoringModel';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MselPageDataService } from 'src/app/data/msel-page/msel-page-data.service';
import { MselPageQuery } from 'src/app/data/msel-page/msel-page.query';
import { MselUnitQuery } from 'src/app/data/msel-unit/msel-unit.query';
import { MselCompetencyDataService } from 'src/app/data/msel-competency/msel-competency-data.service';
import { MselCompetencyQuery } from 'src/app/data/msel-competency/msel-competency.query';
import { CompetencyFrameworkQuery } from 'src/app/data/competency-framework/competency-framework.query';
import { CompetencyFrameworkDataService } from 'src/app/data/competency-framework/competency-framework-data.service';
import { MatDialog } from '@angular/material/dialog';
import { ShowOnDirtyErrorStateMatcher } from '@angular/material/core';
import { CompetencyOptionsDialogComponent } from '../competency-options-dialog/competency-options-dialog.component';
import { EDITOR_CONFIG_PARAGRAPH, VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { casterVmAppWarning } from 'src/app/utilities/caster-vm-app';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { IntegrationStatusComponent } from '../integration-status/integration-status.component';
import { MatTabGroup, MatTab, MatTabLabel } from '@angular/material/tabs';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatLabel, MatFormField, MatInput, MatError, MatHint, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { NgxMatDatepickerInput, NgxMatDatetimepicker, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel } from '@ngxmc/datetime-picker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { ClipboardModule } from 'ngx-clipboard';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { CardEditDialogComponent } from '../card-edit-dialog/card-edit-dialog.component';
import { DatePipe } from '@angular/common';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { normalizeScoringModel } from 'src/app/utilities/scoring-model';
import { MselScoringModelComponent } from '../msel-scoring-model/msel-scoring-model.component';

@Component({
    selector: 'app-msel-info',
    templateUrl: './msel-info.component.html',
    styleUrls: ['./msel-info.component.scss'],
    imports: [IntegrationStatusComponent, MatTabGroup, MatTab, MatIconButton, MatIcon, MatLabel, MatMenuTrigger, MatMenu, MatMenuItem, MatFormField, MatInput, FormsModule, MatError, MatHint, MatCheckbox, NgxMatDatepickerInput, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, DurationEditComponent, MatSelect, MatOption, ClipboardModule, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatTooltip, AngularEditorModule, MatTabLabel, CardEditDialogComponent, DatePipe, TimezoneAbbrPipe, MatRadioGroup, MatRadioButton, MselScoringModelComponent]
})
export class MselInfoComponent implements OnDestroy, OnInit {
  dialogService = inject(CrucibleDialogService);
  private teamQuery = inject(TeamQuery);
  private userQuery = inject(UserQuery);
  private userDataService = inject(UserDataService);
  private dataFieldQuery = inject(DataFieldQuery);
  private mselDataService = inject(MselDataService);
  private mselService = inject(MselService);
  private mselQuery = inject(MselQuery);
  private citeService = inject(CiteService);
  private playerService = inject(PlayerService);
  private casterService = inject(CasterService);
  private playerApplicationDataService = inject(PlayerApplicationDataService);
  private playerApplicationQuery = inject(PlayerApplicationQuery);
  private mselPageDataService = inject(MselPageDataService);
  private mselPageQuery = inject(MselPageQuery);
  private mselUnitQuery = inject(MselUnitQuery);
  private mselCompetencyDataService = inject(MselCompetencyDataService);
  private mselCompetencyQuery = inject(MselCompetencyQuery);
  private competencyFrameworkQuery = inject(CompetencyFrameworkQuery);
  private competencyFrameworkDataService = inject(CompetencyFrameworkDataService);
  private dialog = inject(MatDialog);
  private permissionDataService = inject(PermissionDataService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private activatedRoute = inject(ActivatedRoute);
  private settingsService = inject(ComnSettingsService);
  private scenarioEventQuery = inject(ScenarioEventQuery);
  private mselScoringModelService = inject(MselScoringModelService);

  readonly loggedInUserId = input<string>(undefined);
  readonly deleteThisMsel = output<string>();
  msel = new MselPlus();
  originalMsel = new MselPlus();
  expandedScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  private unsubscribe$ = new Subject();
  // context menu
  readonly contextMenu = viewChild(MatMenuTrigger);
  readonly scoringModelSourceGroup = viewChild(MatRadioGroup);
  contextMenuPosition = { x: '0px', y: '0px' };
  isChanged = false;
  // The card image is saved on its own, as soon as it is chosen, not with Save.
  mselImageUrl: string | null = null;
  isImageBusy = false;
  readonly mselImageTypes = 'image/png,image/jpeg,image/gif,image/webp';
  private mselImageKey: string | null = null;
  private mselImageDataService = inject(MselImageDataService);
  private errorService = inject(ErrorService);
  private systemMessageService = inject(SystemMessageService);
  userList: User[] = [];
  teamList: Team[] = [];
  mselUnitList: MselUnit[] = [];
  mselCompetencyList: MselCompetency[] = [];
  workRoleCount = 0;
  workRoleCompetencies: Competency[] = [];
  nonWorkRoleCompetencies: Competency[] = [];
  competencyFrameworkNames: string[] = [];
  private competencyTypeCache = new Map<string, string>();
  creatorName = 'unknown';
  scoringModelList: ScoringModel[] = [];
  // A MSEL either links a CITE scoring model or authors its own in Blueprint, which is saved as soon as it changes.
  authoredScoringModel: MselScoringModel | null = null;
  citeScoringModelSource: 'link' | 'author' = 'link';
  casterDirectoryList: CasterDirectory[] = [];
  casterDirectoryError = '';
  private casterDirectoriesRequested = false;
  playerApplicationList: PlayerApplication[] = [];
  // Pushing, Pulling and Deployed are set only by pushing and pulling integrations
  itemStatus: MselItemStatus[] = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Archived,
  ];
  private pipelineStatuses: MselItemStatus[] = [
    MselItemStatus.Pushing,
    MselItemStatus.Pulling,
    MselItemStatus.Deployed,
  ];
  educationalLevels: string[] = ['Beginner', 'Intermediate', 'Advanced'];
  educationalUses: string[] = ['Assessment', 'Instruction', 'Professional Support'];
  courseModes: string[] = ['Online', 'Onsite', 'Blended'];
  viewUrl: string;
  starterUrl: string;
  assessorUrl: string;
  mselPages: MselPage[] = [];
  newMselPage = {} as MselPage;
  changedMselPage = {} as MselPage;
  currentTabIndex = 0;
  editingPageId = '';
  private newlyAddedPageName = '';
  // Map to store unsaved changes for each page
  private unsavedPageChanges = new Map<string, MselPage>();
  editorConfig = EDITOR_CONFIG_PARAGRAPH;
  viewConfig = VIEW_CONFIG;
  isBusy = true;
  dataFieldList: DataField[] = [];
  scenarioEventList: ScenarioEvent[] = [];
  basePageUrl = document.baseURI + '/mselpage/';
  savedStartTime: Date;
  savedDurationSeconds = 0;
  playerViewName = '';
  galleryCollectionName = '';
  galleryExhibitName = '';
  citeEvaluationName = '';
  citeScoringModelName = '';
  steamfitterScenarioName = '';
  casterDirectoryName = '';
  casterWorkspaceName = '';
  integrationRequested = '';
  integrationDismissed = false;
  get pushStatus(): string {
    const integrationStatus = this.msel?.integrationStatus || '';
    return this.integrationDismissed && integrationStatus.startsWith('ERROR')
      ? ''
      : integrationStatus;
  }
  constructor() {
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
            this.assessorUrl = document.baseURI + 'assess/?msel=' + this.msel.id;
            this.mselPageDataService.loadByMsel(msel.id);
            this.mselCompetencyDataService.loadByMsel(msel.id);
            // the Caster warning needs to know whether any application opens the VM UI
            this.playerApplicationDataService.loadByMsel(msel.id);
            this.newMselPage.mselId = msel.id;
            this.loadAuthoredScoringModel(msel.id);
          }
          if (!this.msel?.integrationStatus) {
            this.integrationRequested = '';
            this.integrationDismissed = false;
            this.clearDismissedIntegrationError();
          } else if (this.msel.integrationStatus.startsWith('ERROR')) {
            this.integrationDismissed =
              sessionStorage.getItem(this.dismissedIntegrationErrorKey) === this.msel.integrationStatus;
          } else if (!this.msel.integrationStatus.startsWith('ERROR')) {
            this.integrationDismissed = false;
            this.clearDismissedIntegrationError();
          }
          this.savedStartTime = new Date(msel.startTime);
          this.savedDurationSeconds = msel.durationSeconds;
          // Update scoring model name when scoring model ID changes
          this.updateCiteScoringModelName();
          // Fetch integration names for deployed integrations
          this.fetchIntegrationNames();
          this.resolveCreatorName();
          this.loadMselImage();
          if (this.msel.useCaster) {
            this.loadCasterDirectories();
          }
        }
      });
    // subscribe to MSEL loading flag
    this.mselQuery
      .selectLoading()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoading) => {
        this.isBusy = isLoading;
      });
    // subscribe to users
    this.userQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
        this.resolveCreatorName();
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
    // subscribe to mselCompetencies
    this.mselCompetencyQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((mselCompetencies) => {
        this.mselCompetencyList = mselCompetencies;
        const isWorkRole = (mc: MselCompetency) => {
          const id = mc.competency?.idNumber || '';
          return id.includes('WRL')
            || /^[A-Z]{2}-[A-Z]{3}-\d+$/.test(id)
            || /^[A-Z]{2}-\d+[A-Z]?$/.test(id);
        };
        this.workRoleCompetencies = mselCompetencies
          .filter(mc => isWorkRole(mc) && mc.competency)
          .map(mc => mc.competency)
          .sort((a, b) => (a.idNumber || '').localeCompare(b.idNumber || ''));
        this.nonWorkRoleCompetencies = mselCompetencies
          .filter(mc => !isWorkRole(mc) && mc.competency)
          .map(mc => mc.competency)
          .sort((a, b) => (a.idNumber || '').localeCompare(b.idNumber || ''));
        this.workRoleCount = this.workRoleCompetencies.length;
        this.updateFrameworkNames();
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
        // Filter out evaluation-specific scoring models (keep only templates with evaluationId == null)
        this.scoringModelList = (scoringModels || []).filter(sm => !sm.evaluationId);
        // Update the scoring model name after list is loaded
        this.updateCiteScoringModelName();
      },
      (error) => {
        console.error('Failed to load CITE scoring models:', error);
        this.scoringModelList = [];
      }
    );
    // subscribe to player applications
    this.playerApplicationQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((playerApplications) => {
        this.playerApplicationList = playerApplications;
      });
    // subscribe to data fields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.dataFieldList = dataFields;
      });
    // subscribe to scenario events
    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((scenarioEvents) => {
        this.scenarioEventList = scenarioEvents;
      });
  }

  ngOnInit() {
    // Load permissions and trigger change detection when loaded
    this.permissionDataService.load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
    this.competencyFrameworkDataService.load();
    this.competencyFrameworkQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => this.updateFrameworkNames());
  }

  private updateFrameworkNames() {
    const fwIds = new Set<string>();
    for (const mc of this.mselCompetencyList) {
      if (mc.competency?.competencyFrameworkId) {
        fwIds.add(mc.competency.competencyFrameworkId);
      }
    }
    const frameworks = this.competencyFrameworkQuery.getAll();
    this.competencyFrameworkNames = [...fwIds]
      .map(id => frameworks.find(f => f.id === id)?.name || '')
      .filter(n => n)
      .sort();
  }

  getCompetencyTooltip(comp: Competency): string {
    return comp?.shortName || '';
  }

  private getCompetencyType(comp: Competency): string {
    if (!comp || !comp.id) return '';

    // Check cache first
    if (this.competencyTypeCache.has(comp.id)) {
      return this.competencyTypeCache.get(comp.id) || '';
    }

    // Derive from ID pattern
    const idNumber = comp.idNumber || '';
    let type = '';

    if (idNumber.includes('WRL')) {
      type = 'Work Role';
    } else if (/^[TKSA][\d-]/.test(idNumber)) {
      const prefixMap: Record<string, string> = {
        'T': 'Task', 'K': 'Knowledge', 'S': 'Skill', 'A': 'Ability',
      };
      type = prefixMap[idNumber.charAt(0)] || '';
    } else if (/^[A-Z]{2}-[A-Z]{3}-\d+$/.test(idNumber)) {
      type = 'Work Role';
    } else if (/^[A-Z]{2}-\d+[A-Z]?$/.test(idNumber)) {
      type = 'Work Role';
    } else if (/^[A-Z]{3}$/.test(idNumber)) {
      type = 'Specialty Area';
    } else if (/^[A-Z]{2}$/.test(idNumber)) {
      type = 'Category';
    }

    this.competencyTypeCache.set(comp.id, type);
    return type;
  }

  getUserName(userId: string) {
    const user = this.userList.find((u) => u.id === userId);
    return user ? user.name : 'unknown';
  }

  // The creator fetched by id; the MSEL's user list is reloaded wholesale, which drops it again.
  private creatorLookupId = '';

  private resolveCreatorName(): void {
    const emptyGuid = '00000000-0000-0000-0000-000000000000';
    if (!this.msel?.createdBy || this.msel.createdBy === emptyGuid) {
      this.creatorName = 'unknown';
      return;
    }
    const user = this.userList.find(u => u.id === this.msel.createdBy);
    if (user) {
      this.creatorName = user.name;
    } else if (this.creatorLookupId !== this.msel.createdBy) {
      this.creatorLookupId = this.msel.createdBy;
      this.userDataService.loadById(this.msel.createdBy)
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe({
          next: (u) => { this.creatorName = u?.name || 'unknown'; },
          error: () => { this.creatorName = 'unknown'; }
        });
    }
  }

  // Material's default matcher only shows a field's error once the control has been *touched*,
  // i.e. after it loses focus. Clearing the required Name and seeing nothing wrong until you
  // click elsewhere is poor feedback, so this field reports as soon as it has been edited.
  readonly showErrorWhenDirty = new ShowOnDirtyErrorStateMatcher();

  // A MSEL must have a name. The Save/Cancel buttons live outside the `@if (msel)` block that
  // owns the Name input, so they cannot read that input's `ngModel` template ref — validity has
  // to come from here. This mirrors the required/pattern validators on the field itself, which
  // are what render the mat-error.
  isMselValid(): boolean {
    return !!this.msel?.name?.trim();
  }

  saveChanges() {
    if (!this.isMselValid()) {
      return;
    }
    this.mselDataService.updateMsel(this.msel).subscribe({
      next: () => {
        this.isChanged = false;
      },
      // The failure itself is reported to the user by MselDataService. Keep isChanged set so
      // the "Changes have not been saved!" label stays up and the edit can be retried rather
      // than silently discarded.
      error: () => {},
    });
  }

  cancelChanges() {
    this.isChanged = false;
    Object.assign(this.msel, this.originalMsel);
  }

  deleteMsel() {
    if (this.canManageMsel()) {
      this.dialogService
        .confirm({
          title: 'Delete MSEL', message: 'Are you sure that you want to delete ' + this.msel.name + '?'
        }).afterClosed().subscribe((result) => {
          if (result) {
            this.deleteThisMsel.emit(this.msel.id);
          }
        });
    }
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').editor;
  }

  isPipelineStatus(): boolean {
    return this.pipelineStatuses.includes(this.msel?.status);
  }

  // the integrations were built from these settings, so they stay as they are until Remove Integrations
  integrationsLocked(): boolean {
    const msel = this.msel;
    return this.isPipelineStatus() || !!(msel?.playerViewId || msel?.galleryCollectionId || msel?.galleryExhibitId ||
      msel?.citeEvaluationId || msel?.steamfitterScenarioId || msel?.casterWorkspaceId);
  }

  // the current status is listed even when it is one the user cannot choose, so the field still shows it
  statusOptions(): MselItemStatus[] {
    return this.isPipelineStatus() ? [...this.itemStatus, this.msel.status] : this.itemStatus;
  }

  // Setting the image follows the API's MSEL update rule: the owner or EditMsels.
  canSetMselImage(): boolean {
    return canUpdateMsel(this.msel, this.loggedInUserId(), this.permissionDataService.hasPermission(SystemPermission.EditMsels));
  }

  uploadMselImage(input: HTMLInputElement) {
    const file = input.files?.[0];
    // Clear the input so choosing the same file again still fires change.
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.systemMessageService.displayMessage('Image Too Large', 'Choose an image of 2 MB or less.');
      return;
    }
    this.isImageBusy = true;
    this.mselImageDataService.setImage(this.msel.id, file).subscribe({
      next: () => (this.isImageBusy = false),
      error: (err) => {
        this.isImageBusy = false;
        this.errorService.handleError(err);
      },
    });
  }

  removeMselImage() {
    this.isImageBusy = true;
    this.mselImageDataService.deleteImage(this.msel.id).subscribe({
      next: () => (this.isImageBusy = false),
      error: (err) => {
        this.isImageBusy = false;
        this.errorService.handleError(err);
      },
    });
  }

  private loadMselImage() {
    const key = this.msel.id + '|' + (this.msel.imageDateModified ?? '');
    if (key === this.mselImageKey) {
      return;
    }
    this.mselImageKey = key;
    this.mselImageUrl = null;
    this.mselImageDataService
      .imageUrl(this.msel)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((url) => {
        if (key === this.mselImageKey) {
          this.mselImageUrl = url;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  // the scoring model the MSEL authors follows the API's rule for the MSEL's scoring model link: EditMsels or the owner
  canAuthorScoringModel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').owner;
  }

  canManageMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').owner;
  }

  getDeleteTooltip(): string {
    if (!this.canManageMsel()) {
      return 'You do not have permission to delete this MSEL';
    }
    if (this.msel?.status === 'Deployed') {
      return 'Cannot delete deployed MSEL';
    }
    if (this.msel?.isTemplate) {
      return 'Cannot delete template MSELs';
    }
    return 'Delete this MSEL';
  }

  openCompetencyPicker(): void {
    const existingIdNumbers = this.mselCompetencyList.map(mc => mc.competency?.idNumber).filter(Boolean);
    const dialogRef = this.dialog.open(CompetencyOptionsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        dataFieldId: null,
        dataOptions: existingIdNumbers.map(idNumber => ({ optionName: idNumber })),
        canEdit: this.canEditMsel()
      }
    });
    dialogRef.afterClosed().subscribe((updatedOptions) => {
      if (!updatedOptions) return;
      const newIdNumbers = new Set(updatedOptions.map((o: any) => o.optionName));
      const existingMap = new Map<string, MselCompetency>();
      for (const mc of this.mselCompetencyList) {
        if (mc.competency?.idNumber) {
          existingMap.set(mc.competency.idNumber, mc);
        }
      }
      // Remove deselected
      for (const [idNumber, mc] of existingMap) {
        if (!newIdNumbers.has(idNumber)) {
          this.mselCompetencyDataService.delete(mc.id);
        }
      }
      // Add newly selected — need to resolve idNumber to competencyId
      // The dialog returns DataOption-shaped objects with optionName = idNumber
      // We need the competency ID, which we can get from the dialog's competencies
      for (const opt of updatedOptions) {
        if (!existingMap.has(opt.optionName) && opt.competencyId) {
          this.mselCompetencyDataService.add({
            mselId: this.msel.id,
            competencyId: opt.competencyId
          });
        }
      }
    });
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
      warningMessage = this.citeToDo()
        ? '** There are unassigned CITE Team Types in Teams **'
        : '';
    }
    return warningMessage;
  }

  hasCiteTeamsWithoutType() {
    // Returns true if CITE is enabled and there are teams without a CITE team type
    // This blocks the push button similar to the scoring model requirement
    if (!this.msel.useCite || this.msel.citeEvaluationId) {
      return false; // CITE not enabled or already deployed, no validation needed
    }
    return this.citeToDo();
  }

  hasGalleryEventsWithMissingData(): boolean {
    // Get the IDs of data fields that have a galleryArticleParameter assigned
    const galleryDataFieldIds = this.dataFieldList
      .filter((df) => df.galleryArticleParameter && df.galleryArticleParameter !== '- - -')
      .map((df) => df.id);
    if (galleryDataFieldIds.length === 0) {
      return false;
    }
    // Check scenario events that target Gallery
    const galleryEvents = this.scenarioEventList.filter(
      (se) => se.integrationTarget?.includes('Gallery')
    );
    return galleryEvents.some((se) => {
      return galleryDataFieldIds.some((dfId) => {
        const dataValue = se.dataValues?.find((dv) => dv.dataFieldId === dfId);
        return !dataValue || !dataValue.value;
      });
    });
  }

  pushIntegrations() {
    let message = 'Are you sure that you want to push MSEL data to the selected applications?';
    if (this.msel.useGallery && this.hasGalleryEventsWithMissingData()) {
      message += '\n\n** WARNING: One or more Scenario Events marked as a Gallery integration is missing required fields. **';
    }
    this.dialogService
      .confirm({
        title: 'Push Integrations', message: message
      }).afterClosed().subscribe((result) => {
        if (result) {
          this.integrationDismissed = false;
          this.clearDismissedIntegrationError();
          this.integrationRequested = 'push';
          this.mselDataService.pushIntegrations(this.msel.id);
        }
      });
  }

  pullIntegrations() {
    this.dialogService
      .confirm({
        title: 'Remove Integrations', message: 'Are you sure you want to remove this MSEL from the associated applications?'
      }).afterClosed().subscribe((result) => {
        if (result) {
          this.integrationDismissed = false;
          this.clearDismissedIntegrationError();
          this.integrationRequested = 'pull';
          this.mselDataService.pullIntegrations(this.msel.id);
        }
      });
  }

  dismissIntegrationStatus() {
    this.integrationRequested = '';
    this.integrationDismissed = true;
    if (this.msel?.integrationStatus?.startsWith('ERROR')) {
      sessionStorage.setItem(this.dismissedIntegrationErrorKey, this.msel.integrationStatus);
    }
  }

  private get dismissedIntegrationErrorKey(): string {
    return `blueprint.dismissedIntegrationError.${this.msel?.id || ''}`;
  }

  private clearDismissedIntegrationError(): void {
    sessionStorage.removeItem(this.dismissedIntegrationErrorKey);
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
      .confirm({
        title: 'Delete Page', message: 'Are you sure that you want to delete ' + page.name + '?'
      }).afterClosed().subscribe((result) => {
        if (result) {
          // Clear any unsaved changes for this page
          this.unsavedPageChanges.delete(page.id);
          this.mselPageDataService.delete(page.id);
          // Switch back to Config tab after deletion
          this.currentTabIndex = 0;
        }
      });
  }

  openContent(id: string) {
    const themeParam = this.activatedRoute.snapshot.queryParamMap.get('theme');
    const url = themeParam ? `${this.basePageUrl}${id}?theme=${themeParam}` : `${this.basePageUrl}${id}`;
    window.open(url);
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

  citeToDo(): boolean {
    // every team on this MSEL must have a CITE team type assigned before pushing
    return this.teamList.some(
      (t) => t.mselId === this.msel.id && !t.citeTeamTypeId
    );
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

  loadAuthoredScoringModel(mselId: string) {
    this.authoredScoringModel = null;
    this.citeScoringModelSource = 'link';
    this.mselScoringModelService
      .getMselScoringModel(mselId)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (model) => {
          // the answer for a MSEL the user has since left is not this one's
          if (this.msel.id !== mselId) {
            return;
          }
          this.authoredScoringModel = model ? normalizeScoringModel(model) : null;
          this.citeScoringModelSource = model ? 'author' : 'link';
        },
        error: (error) => console.error('Failed to load the MSEL scoring model:', error),
      });
  }

  // the push needs a scoring model to make the CITE evaluation from, linked or authored
  hasCiteScoringModel(): boolean {
    return !!this.msel.citeScoringModelId || !!this.authoredScoringModel;
  }

  onScoringModelSourceChange(source: 'link' | 'author') {
    if (source !== 'link' || !this.authoredScoringModel) {
      this.citeScoringModelSource = source;
      return;
    }
    // linking a CITE model replaces the one authored here, which is deleted
    const authored = this.authoredScoringModel;
    this.dialogService
      .confirm({
        title: 'Link a CITE Scoring Model',
        message: `Linking a CITE scoring model deletes "${authored.description}", the scoring model authored in Blueprint. Delete it?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.keepAuthoredSource();
          return;
        }
        this.mselScoringModelService.deleteMselScoringModel(this.msel.id).subscribe({
          next: () => {
            this.authoredScoringModel = null;
            this.citeScoringModelSource = 'link';
          },
          error: (err) => {
            this.keepAuthoredSource();
            this.errorService.handleError(err);
          },
        });
      });
  }

  // the radio group moved to the link when it was clicked; the source it is bound to never did
  private keepAuthoredSource() {
    const group = this.scoringModelSourceGroup();
    if (group) {
      group.value = 'author';
    }
  }

  updateCiteScoringModelName() {
    if (!this.msel.citeScoringModelId) {
      this.citeScoringModelName = '';
      return;
    }
    // The list may not have arrived yet, or may not contain this scoring model (it is filtered to
    // the ones with no evaluation). Either way, leave the name fetchIntegrationNames supplied
    // alone rather than blanking it -- this runs again when the list arrives, so a stale empty
    // name here would clobber a good one.
    const scoringModel = this.scoringModelList.find(sm => sm.id === this.msel.citeScoringModelId);
    if (scoringModel) {
      this.citeScoringModelName = scoringModel.description;
    } else if (this.scoringModelList.length > 0) {
      console.warn(`Scoring Model ID ${this.msel.citeScoringModelId} not found in list of ${this.scoringModelList.length} scoring models`);
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

  casterDirectoryLabel(directory: CasterDirectory): string {
    return `${directory.projectName} / ${directory.name}`;
  }

  get selectedCasterDirectory(): CasterDirectory {
    return this.casterDirectoryList.find(d => d.id === this.msel.casterDirectoryId);
  }

  // On its project page, Caster opens a workspace's tab from ?workspace= and expands a directory from ?directory=;
  // a Caster without them opens the project
  getCasterWorkspaceUrl(): string {
    return this.msel.casterWorkspaceId ? this.getCasterProjectUrl(`workspace=${this.msel.casterWorkspaceId}`) : '';
  }

  getCasterDirectoryUrl(): string {
    return this.getCasterProjectUrl(`directory=${this.msel.casterDirectoryId}`);
  }

  private getCasterProjectUrl(query: string): string {
    const directory = this.selectedCasterDirectory;
    if (!directory) return '';
    let baseUrl = this.settingsService.settings.CasterUrl || '';
    if (baseUrl && baseUrl.slice(-1) !== '/') {
      baseUrl = baseUrl + '/';
    }
    return `${baseUrl}projects/${directory.projectId}?${query}`;
  }

  casterWarningMessage(): string {
    if (!this.msel.useCaster) return '';
    if (!this.msel.usePlayer) return 'Caster requires Player: the VMs are added to the Player view and its teams.';
    if (!this.msel.casterDirectoryId) return 'Select the Caster directory to deploy.';
    return '';
  }

  casterVmAppWarningMessage(): string {
    return casterVmAppWarning(this.msel, this.playerApplicationList, this.settingsService.settings.VmUrl);
  }

  fetchIntegrationNames() {
    // Only fetch names when integrations are fully deployed
    if (this.msel.status !== 'Deployed') {
      this.clearIntegrationNames();
      return;
    }

    // One call to Blueprint's own API, which reads each name from the application that owns it.
    // The browser cannot read them itself: Player, Gallery, CITE and Steamfitter each allow only
    // their own UI's origin, so fetching a name directly from here is blocked by CORS before the
    // request is even sent. Blueprint forwards this user's own token for each lookup, so nothing
    // is revealed that the user could not have read.
    this.mselService
      .getMselIntegrationNames(this.msel.id)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(
        (names) => {
          this.playerViewName = names.playerViewName || '';
          this.galleryCollectionName = names.galleryCollectionName || '';
          this.galleryExhibitName = names.galleryExhibitName || '';
          this.citeEvaluationName = names.citeEvaluationName || '';
          this.citeScoringModelName = names.citeScoringModelName || '';
          this.steamfitterScenarioName = names.steamfitterScenarioName || '';
          this.casterDirectoryName = names.casterDirectoryName || '';
          this.casterWorkspaceName = names.casterWorkspaceName || '';
        },
        (error) => {
          console.error('Failed to load integration names:', error);
          this.clearIntegrationNames();
        }
      );
  }

  // load the Caster directories this user can deploy from, once, and only for a MSEL that uses Caster.
  // Caster answers with the user's own permissions, so the list holds only directories the user can view in Caster.
  loadCasterDirectories() {
    if (this.casterDirectoriesRequested) {
      return;
    }
    this.casterDirectoriesRequested = true;
    this.casterService.getCasterDirectories().subscribe(
      (directories) => {
        this.casterDirectoryList = directories || [];
        this.casterDirectoryError = '';
      },
      (error) => {
        console.error('Failed to load Caster directories:', error);
        this.casterDirectoryList = [];
        this.casterDirectoryError = 'Caster directories could not be loaded. You need access to Caster to choose one.';
        // checking Caster again retries
        this.casterDirectoriesRequested = false;
      }
    );
  }

  private clearIntegrationNames() {
    this.playerViewName = '';
    this.galleryCollectionName = '';
    this.galleryExhibitName = '';
    this.citeEvaluationName = '';
    this.citeScoringModelName = '';
    this.steamfitterScenarioName = '';
    this.casterDirectoryName = '';
    this.casterWorkspaceName = '';
  }

  hasPendingChanges(): boolean {
    return this.isChanged || this.hasUnsavedPageChanges();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasPendingChanges()) {
      event.preventDefault();
    }
  }

  downloadJsonFile() {
    this.mselDataService.downloadJson(this.msel.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = this.msel.name + '-msel.json';
        link.click();
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }

  downloadXlsxFile() {
    this.mselDataService.downloadXlsx(this.msel.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = this.msel.name.endsWith('.xlsx')
          ? this.msel.name
          : this.msel.name + '.xlsx';
        link.click();
      },
      (err) => {
        window.alert('Error downloading file');
      }
    );
  }

  ngOnDestroy() {
    // Clear the unsaved changes map to prevent memory leaks
    this.unsavedPageChanges.clear();
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
