// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { UntypedFormControl, FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import {
  CdkDragDrop,
  CdkDragStart,
  CdkDragEnd,
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
} from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { Subject, Subscription, Observable, of, take } from 'rxjs';
import {
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  mergeMap,
  delay,
} from 'rxjs/operators';
import { ComnSettingsService, Theme } from '@cmusei/crucible-common';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import {
  AutomationRun,
  AutomationRunKind,
  AutomationTask,
  Card,
  Catalog,
  CreateFromInjectsForm,
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  InjectType,
  MselItemStatus,
  Move,
  Msel,
  MselRole,
  Organization,
  ScenarioEvent,
  SystemPermission,
  Team,
  Unit,
  User,
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort, MatSort, MatSortHeader } from '@angular/material/sort';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { CardQuery } from 'src/app/data/card/card.query';
import { CatalogQuery } from 'src/app/data/catalog/catalog.query';
import { InjectmDataService } from 'src/app/data/injectm/injectm-data.service';
import { InjectSelectDialogComponent } from '../inject-select-dialog/inject-select-dialog.component';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import {
  ScenarioEventDataService,
  ScenarioEventView,
  ScenarioEventViewIndexing,
  DataValuePlus,
  IntegrationTarget,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventCopyDialogComponent } from '../scenario-event-copy-dialog/scenario-event-copy-dialog.component';
import {
  ScenarioEventEditDialogComponent,
  ScenarioEventEditDialogData,
} from '../scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { v4 as uuidv4 } from 'uuid';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { AutomationRunDataService } from 'src/app/data/automation-run/automation-run-data.service';
import {
  AutomationRunQuery,
  newestFirst,
} from 'src/app/data/automation-run/automation-run.query';
import { AutomationTaskDataService } from 'src/app/data/automation-task/automation-task-data.service';
import {
  AutomationTaskQuery,
  byDisplayOrder,
} from 'src/app/data/automation-task/automation-task.query';
import {
  AutomationTaskDraft,
  copyDrafts,
  draftFromTask,
  latestRunByTask,
  overallStatus,
  triggerSummary,
} from 'src/app/utilities/automation-tasks';
import { canViewFacilitator } from 'src/app/utilities/facilitator-msels';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';
import {
  AutomationTestDialogComponent,
  AutomationTestDialogData,
} from '../automation-test-dialog/automation-test-dialog.component';
import { AutomationTriggerOption } from '../automation-task-list/automation-task-list.component';
import { MatIcon } from '@angular/material/icon';
import { MatCheckbox } from '@angular/material/checkbox';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { DataValueComponent } from '../data-value/data-value.component';

interface StringDictionary {
  [key: string]: string;
}

@Component({
  selector: 'app-scenario-event-list',
  templateUrl: './scenario-event-list.component.html',
  styleUrls: ['./scenario-event-list.component.scss'],
  imports: [
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatIcon,
    MatSort,
    MatCheckbox,
    MatMenuTrigger,
    MatMenu,
    MatMenuItem,
    MatSortHeader,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    DurationViewComponent,
    MatSelect,
    MatOption,
    DataValueComponent,
    MatButton,
    MatTooltip,
    AutomationStatusChipComponent,
  ],
})
export class ScenarioEventListComponent
  implements OnDestroy, OnInit, ScenarioEventView
{
  private router = inject(Router);
  private permissionDataService = inject(PermissionDataService);
  private settingsService = inject(ComnSettingsService);
  private cardQuery = inject(CardQuery);
  private catalogQuery = inject(CatalogQuery);
  private injectmDataService = inject(InjectmDataService);
  private injectTypeQuery = inject(InjectTypeQuery);
  private moveQuery = inject(MoveQuery);
  private mselDataService = inject(MselDataService);
  private mselQuery = inject(MselQuery);
  private organizationQuery = inject(OrganizationQuery);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private scenarioEventQuery = inject(ScenarioEventQuery);
  dialogService = inject(CrucibleDialogService);
  dialog = inject(MatDialog);
  private dataFieldQuery = inject(DataFieldQuery);
  private dataValueDataService = inject(DataValueDataService);
  private dataValueQuery = inject(DataValueQuery);
  private teamQuery = inject(TeamQuery);
  private unitQuery = inject(UnitQuery);
  private uiDataService = inject(UIDataService);
  private automationTaskDataService = inject(AutomationTaskDataService);
  private automationTaskQuery = inject(AutomationTaskQuery);
  private automationRunDataService = inject(AutomationRunDataService);
  private automationRunQuery = inject(AutomationRunQuery);
  private changeDetectorRef = inject(ChangeDetectorRef);

  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
  readonly isStarterMsel = input<boolean>(undefined);
  msel = new MselPlus();

  // ScenarioEventView Fields
  mselScenarioEvents: ScenarioEvent[] = [];
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  displayedScenarioEvents: ScenarioEvent[] = [];
  headerDataFields: DataField[] = [];
  dataValues: DataValue[] = [];
  cardList: Card[] = [];
  mselUsers: User[] = [];
  viewIndex = new ScenarioEventViewIndexing();

  allDataFields: DataField[] = [];
  mselDataFields: DataField[] = [];
  expandedScenarioEventId = '';
  expandedMoreScenarioEventIds: string[] = [];
  newScenarioEvent: ScenarioEvent;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
  dataType: typeof DataFieldType = DataFieldType;
  sortableDataTypes = this.scenarioEventDataService.sortableDataTypes;
  customHandledDataTypes = [
    DataFieldType.Html,
    DataFieldType.Organization,
    DataFieldType.TeamsMultiple,
    DataFieldType.Status,
    DataFieldType.Team,
    DataFieldType.DateTime,
    DataFieldType.User,
    DataFieldType.Checkbox,
    DataFieldType.Card,
    DataFieldType.Move,
  ];
  dateFormControls = new Map<string, UntypedFormControl>();
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];
  mselRole = {
    Owner: MselRole.Owner,
    Approver: MselRole.Approver,
    Editor: MselRole.Editor,
  };
  organizationList: Organization[] = [];
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  // context menu
  readonly contextMenu = viewChild(MatMenuTrigger);
  contextMenuPosition = { x: '0px', y: '0px' };
  scenarioEventBackgroundColors: Array<string>;
  darkThemeTint = this.settingsService.settings.DarkThemeTint
    ? this.settingsService.settings.DarkThemeTint
    : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint
    ? this.settingsService.settings.LightThemeTint
    : 0.4;
  moveList: Move[] = [];
  teamList: Team[] = [];
  unitList: Unit[] = [];
  filterChange = new Subject<string>();
  private subscription: Subscription;
  selectedEventIdList: string[] = [];
  showSearch = false;
  showRealTime = false;
  allowDragAndDrop = true;
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  catalogList: Catalog[] = [];
  injectTypeList: InjectType[] = [];
  eventType: typeof EventType = EventType;
  maxScenarioEventStartSeconds: 0;
  allSelected = false;
  mselListForCopy: Msel[] = [];
  integrationTargetOptions: string[] = [];
  // the MSEL's automation tasks by scenario event, and each task's newest test
  tasksByEvent = new Map<string, AutomationTask[]>();
  latestTests = new Map<string, AutomationRun>();
  hasAutomation = false;
  private testRunsLoadedFor = '';

  constructor() {
    // load the user's build MSELs for use when copying scenario events
    this.mselDataService
      .getMyBuildMsels()
      .pipe(take(1))
      .subscribe((msels) => {
        this.mselListForCopy = msels.sort((a, b) =>
          a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
        );
      });
    this.scenarioEventBackgroundColors =
      this.settingsService.settings.ScenarioEventBackgroundColors;
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel && this.msel.id !== msel.id) {
          this.msel = this.getEditableMsel(msel) as MselPlus;
          this.mselUsers = this.getMselUsers();
          this.scenarioEventDataService.updateScenarioEventViewUsers(this);
          this.automationTaskDataService.loadByMsel(msel.id);
          this.loadTestRuns();
          const options = [];
          if (msel.useGallery) {
            options.push(IntegrationTarget.Gallery);
          }
          this.integrationTargetOptions = options;
          // in case the dataFields were received before the msel
          if (this.allDataFields.length > 0) {
            this.setSortedDataFields();
            this.scenarioEventDataService.updateScenarioEventViewDataFields(
              this,
            );
            this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
              this,
            );
          }
        }
      });
    // subscribe to data fields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.allDataFields = dataFields;
        this.setSortedDataFields();
        this.scenarioEventDataService.updateScenarioEventViewDataFields(this);
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
      });
    // subscribe to data values
    this.dataValueQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataValues) => {
        this.dataValues = [];
        dataValues.forEach((dv) => {
          this.dataValues.push({ ...dv });
        });
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
      });
    // subscribe to scenario events
    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((scenarioEvents) => {
        this.scenarioEventDataService.refreshScenarioEventViewEvents(
          this,
          scenarioEvents,
        );
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.moveAndGroupNumbers =
            this.scenarioEventDataService.getMoveAndGroupNumbers(
              this.mselScenarioEvents,
              this.moveList,
            );
          this.maxScenarioEventStartSeconds = Math.max.apply(
            Math,
            scenarioEvents.map(function (o) {
              return +o.deltaSeconds;
            }),
          );
        }
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
      });
    this.automationTaskQuery
      .selectAll({ sortBy: byDisplayOrder })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((tasks) => {
        const byEvent = new Map<string, AutomationTask[]>();
        tasks
          .filter((t) => t.mselId === this.msel.id)
          .forEach((t) =>
            byEvent.set(t.scenarioEventId, [
              ...(byEvent.get(t.scenarioEventId) ?? []),
              t,
            ]),
          );
        this.tasksByEvent = byEvent;
        this.hasAutomation = byEvent.size > 0;
      });
    this.automationRunQuery
      .selectAll({
        filterBy: (r) => r.kind === AutomationRunKind.Test,
        sortBy: newestFirst,
      })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((runs) => (this.latestTests = latestRunByTask(runs)));
    // is user a contentdeveloper or system admin?
    this.permissionDataService
      .load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.canDoAnything = this.permissionDataService.hasPermission(
          SystemPermission.CreateMsels,
        );
        // the MSEL may have arrived first
        this.loadTestRuns();
        this.changeDetectorRef.markForCheck();
      });
    // subscribe to organizations
    this.organizationQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((organizations) => {
        this.organizationList = organizations.filter(
          (org) => !org.isTemplate && org.mselId === this.msel.id,
        );
      });
    // observe the Cards
    this.cardQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cards) => {
        this.cardList = cards;
      });
    this.scenarioEventDataService.updateScenarioEventViewCards(this);
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
    // observe the Moves
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1,
        );
        this.moveAndGroupNumbers =
          this.scenarioEventDataService.getMoveAndGroupNumbers(
            this.mselScenarioEvents,
            this.moveList,
          );
      });
    // observe the Teams
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => {
        this.teamList = teams;
      });
    // observe the Units
    this.unitQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((units) => {
        this.unitList = units;
      });
    // subscribe to filter string changes for debounce
    this.subscription = this.filterChange
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        mergeMap((search) => of(search).pipe(delay(250))),
      )
      .subscribe((event) => {
        this.applyFilter(this.filterString);
      });
    // observe the Catalogs
    this.catalogQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((catalogs) => {
        this.catalogList = catalogs;
      });
    // observe the Inject Types
    this.injectTypeQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((injectTypes) => {
        this.injectTypeList = injectTypes;
      });
    // set the time display format
    this.showRealTime = this.uiDataService.useRealTime();
  }

  get userList(): User[] {
    return this.mselUsers;
  }

  get dataFields(): DataField[] {
    return this.headerDataFields;
  }

  get showHiddenEvents(): boolean {
    return true;
  }

  ngOnInit() {
    // Permission loading is handled in the constructor
  }

  canEditMsel(): boolean {
    return (
      this.permissionDataService.hasPermission(SystemPermission.EditMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').editor
    );
  }

  tabChange(event) {
    const injectData = event.tab.textLabel.toLowerCase().replace(' ', '');
    this.router.navigate([], {
      queryParams: { injectData: injectData },
      queryParamsHandling: 'merge',
    });
  }

  getEditableMsel(msel: MselPlus): MselPlus {
    const editableMsel = new MselPlus();
    Object.assign(editableMsel, msel);
    editableMsel.teams = editableMsel.teams
      .slice(0)
      .sort((a, b) =>
        a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1,
      );
    editableMsel.units = editableMsel.units
      .slice(0)
      .sort((a, b) =>
        a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1,
      );

    return editableMsel;
  }

  setSortedDataFields() {
    this.mselDataFields = this.allDataFields;
    if (this.msel && this.msel.id) {
      this.mselDataFields = this.allDataFields
        .filter((m) => m.mselId === this.msel.id)
        .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
    }
    if (this.mselDataFields.length > 0) {
      this.headerDataFields = this.mselDataFields
        .filter((df) => df.onScenarioEventList)
        .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
    }
    // create date form controls
    this.mselDataFields.forEach((df) => {
      if (df.dataType === DataFieldType.DateTime) {
        this.dateFormControls[df.id] = new UntypedFormControl();
      }
    });
  }

  getDataFieldByName(name: string) {
    return this.dataFields.find(
      (df) => df.name.toLowerCase() === name.toLowerCase(),
    );
  }

  getMselUsers(): User[] {
    let users = [];
    this.msel.teams?.forEach((team) => {
      team.users.forEach((user) => {
        users.push({ ...user });
      });
    });
    this.msel.units.forEach((unit) => {
      unit.users.forEach((user) => {
        users.push({ ...user });
      });
    });
    users = users.sort((a, b) =>
      a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1,
    );
    return users;
  }

  toggleNoneSelection(scenarioEvent: ScenarioEvent, dataFieldName: string) {
    const newValues = new Array('None');
    this.getDataValue(scenarioEvent, dataFieldName).value =
      newValues.join(', ');
    this.getDataValue(scenarioEvent, dataFieldName).valueArray = newValues;
    this.dataValueDataService.updateDataValue(
      this.getDataValue(scenarioEvent, dataFieldName),
    );
  }

  trackByFn(index, item) {
    return item.id;
  }

  getSortedOrganizationOptions(): string[] {
    let orgs: string[] = [];
    this.organizationList.forEach((o) => {
      orgs.push(o.shortName);
    });
    this.msel.teams?.forEach((t) => {
      orgs.push(t.shortName);
    });
    // Remove duplicates
    orgs = [...new Set(orgs)];
    orgs = orgs.sort((a, b) => (a?.toLowerCase() < b?.toLowerCase() ? -1 : 1));
    return orgs;
  }

  getSortedTeamOptions(): string[] {
    let teams: string[] = [];
    this.msel.teams?.forEach((t) => {
      teams.push(t.shortName);
    });
    teams = teams.sort((a, b) => (a < b ? -1 : 1));
    return teams;
  }

  scroll(id) {
    const el = document.getElementById(id);
    el.scrollIntoView();
  }

  selectMoreScenarioEvent(id: string) {
    const expandedIndex = this.expandedMoreScenarioEventIds.findIndex(
      (seId) => seId === id,
    );
    if (expandedIndex === -1) {
      this.expandedMoreScenarioEventIds.push(id);
    } else {
      this.expandedMoreScenarioEventIds.splice(expandedIndex, 1);
    }
  }

  newDataValuePlus(
    scenarioEventId: string,
    dataFieldId: string,
  ): DataValuePlus {
    const ndvp = {
      id: uuidv4(),
      scenarioEventId: scenarioEventId,
      dataFieldId: dataFieldId,
      value: '',
      valueArray: [],
    } as DataValuePlus;

    return ndvp;
  }

  getDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string,
  ): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    return this.scenarioEventDataService.getDataValueFromView(
      this,
      scenarioEvent,
      dataFieldName,
    );
  }

  getDisplayValue(scenarioEvent: ScenarioEvent, dataFieldName: string): string {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    return this.scenarioEventDataService.getDisplayValueFromView(
      this,
      scenarioEvent,
      dataFieldName,
    );
  }

  getTeamShortName(teamId: string) {
    if (!teamId) {
      return '';
    }
    const team = this.teamList.find((t) => t.id === teamId);
    return team ? team.shortName : '';
  }

  onContextMenu(event: MouseEvent, scenarioEvent: ScenarioEvent) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    const contextMenu = this.contextMenu();
    contextMenu.menuData = { item: scenarioEvent };
    contextMenu.menu.focusFirstItem('mouse');
    contextMenu.openMenu();
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
    this.allowDragAndDrop = !this.sort.active || this.sort.direction === '';
  }

  dropHandler(event: CdkDragDrop<string[]>) {
    // defaultOffsetSecs is the amount of time to offset a new group that is before or after all others
    const defaultOffsetSecs = 3600;
    if (event.previousIndex !== event.currentIndex) {
      // sanity check
      const droppedScenarioEvt = event.item.data;
      const droppedScenarioEvtIdx = this.viewIndex.mselScenarioEvtIndex.get(
        droppedScenarioEvt.id,
      );
      const targetScenarioEvtId =
        this.displayedScenarioEvents[event.currentIndex].id;
      const targetScenarioEvtIdx =
        this.viewIndex.mselScenarioEvtIndex.get(targetScenarioEvtId);
      const targetScenarioEvt = this.mselScenarioEvents[targetScenarioEvtIdx];
      const movedDown = droppedScenarioEvtIdx < targetScenarioEvtIdx;
      const origOffset = +droppedScenarioEvt.deltaSeconds;
      const origGroupOrder = +droppedScenarioEvt.groupOrder;
      let newOffset = origOffset;
      let newGrpOrder = origGroupOrder;
      // case where we moved the event to the top of the MSEL
      if (0 === targetScenarioEvtIdx) {
        const prevOffset =
          +this.mselScenarioEvents[targetScenarioEvtIdx].deltaSeconds;
        if (prevOffset > 0) {
          newOffset = Math.max(prevOffset - defaultOffsetSecs, 0);
        } else {
          newOffset = prevOffset;
        }
        newGrpOrder =
          newOffset === prevOffset ? +targetScenarioEvt.groupOrder : 0;
        // case where we moved the event to the bottom of the MSEL
      } else if (targetScenarioEvtIdx === this.mselScenarioEvents.length - 1) {
        newOffset =
          +this.mselScenarioEvents[targetScenarioEvtIdx].deltaSeconds +
          defaultOffsetSecs;
        newGrpOrder = 0;
        // case where we moved the event somewhere in the middle of the MSELs
      } else {
        const aboveIndex = movedDown
          ? targetScenarioEvtIdx
          : targetScenarioEvtIdx - 1;
        const belowIndex = aboveIndex + 1;
        const aboveOffset = +this.mselScenarioEvents[aboveIndex].deltaSeconds;
        const belowOffset = +this.mselScenarioEvents[belowIndex].deltaSeconds;

        const timeDiff = belowOffset - aboveOffset;
        if (timeDiff > 1) {
          newOffset = aboveOffset + Math.floor(timeDiff / 2);
          newGrpOrder = 0;
        } else {
          newOffset = belowOffset;
          newGrpOrder = +this.mselScenarioEvents[belowIndex].groupOrder;
        }
      }
      // save the change
      droppedScenarioEvt.deltaSeconds = newOffset;
      droppedScenarioEvt.groupOrder = newGrpOrder;
      this.saveScenarioEvent(droppedScenarioEvt);
    }
  }

  dragStart(event: CdkDragStart) {}

  dragEnd(event: CdkDragEnd) {}

  addScenarioEvent() {
    this.isAddingScenarioEvent = true;
    const newScenarioEvent = {
      id: uuidv4(),
      mselId: this.msel.id,
      status: MselItemStatus.Pending,
      dataValues: [],
      scenarioEventType: EventType.Inject,
      deltaSeconds: this.maxScenarioEventStartSeconds,
    } as ScenarioEvent;
    this.mselDataFields.forEach((df) => {
      newScenarioEvent.dataValues.push({
        dataFieldId: df.id,
        id: uuidv4(),
        scenarioEventId: newScenarioEvent.id,
        value: '',
      });
    });
    this.displayEditDialog(newScenarioEvent);
  }

  editScenarioEvent(scenarioEvent: ScenarioEvent, initialTab = '') {
    this.isAddingScenarioEvent = false;
    const editScenarioEvent = { ...scenarioEvent };
    editScenarioEvent.dataValues = [];
    const seDataValues = this.dataValues.filter(
      (dv) => dv.scenarioEventId === scenarioEvent.id,
    );
    this.mselDataFields.forEach((df) => {
      let dataValue = seDataValues.find((dv) => dv.dataFieldId === df.id);
      if (!dataValue) {
        dataValue = this.newDataValuePlus(scenarioEvent.id, df.id);
      }
      editScenarioEvent.dataValues.push({ ...dataValue });
    });
    this.displayEditDialog(
      editScenarioEvent,
      this.eventTasks(scenarioEvent).map(draftFromTask),
      initialTab,
    );
  }

  copyScenarioEvent(scenarioEvent: ScenarioEvent): void {
    this.isAddingScenarioEvent = true;
    const newScenarioEvent = { ...scenarioEvent };
    newScenarioEvent.id = uuidv4();
    newScenarioEvent.dataValues = [];
    this.dataValues
      .filter((dv) => dv.scenarioEventId === scenarioEvent.id)
      .forEach((dv) => {
        newScenarioEvent.dataValues.push({
          id: uuidv4(),
          dataFieldId: dv.dataFieldId,
          scenarioEventId: newScenarioEvent.id,
          value: dv.value,
        });
      });
    // the copy's tasks trigger each other as the originals do; secrets are not copied
    this.displayEditDialog(
      newScenarioEvent,
      copyDrafts(this.eventTasks(scenarioEvent).map(draftFromTask)),
    );
  }

  displayEditDialog(
    scenarioEvent: ScenarioEvent,
    automationTasks: AutomationTaskDraft[] = [],
    initialTab = '',
  ) {
    const isOwner =
      this.canEditMsel() ||
      this.msel.hasRole(this.loggedInUserId(), scenarioEvent.id).owner;
    const isApprover =
      isOwner ||
      this.msel.hasRole(this.loggedInUserId(), scenarioEvent.id).approver;
    const isEditor =
      isApprover ||
      this.msel.hasRole(this.loggedInUserId(), scenarioEvent.id).editor;

    const dialogRef = this.dialog.open(ScenarioEventEditDialogComponent, {
      minWidth: '900px',
      maxWidth: '90vw',
      width: 'auto',
      maxHeight: '90vh',
      data: {
        scenarioEvent: scenarioEvent,
        integrationTargetOptions: this.integrationTargetOptions,
        dataFields: this.mselDataFields,
        organizationList: this.getSortedOrganizationOptions(),
        teamList: this.teamList,
        unitList: this.unitList,
        moveList: this.moveList,
        cardList: this.cardList,
        gallerySourceTypes: this.msel.gallerySourceTypes,
        galleryItemStatuses: this.msel.galleryItemStatuses,
        isNew: this.isAddingScenarioEvent,
        isOwner: isOwner,
        isApprover: isApprover,
        isEditor: isEditor,
        isEditingRestricted: this.isStarterMsel(),
        showScenarioEventType: !this.isStarterMsel(),
        useCite: this.msel.useCite,
        useGallery: this.msel.useGallery,
        userList: this.mselUsers,
        mselStartTime: this.msel.startTime,
        mselId: this.msel.id,
        automationTasks,
        savedTaskIds: this.isAddingScenarioEvent
          ? []
          : this.eventTasks(scenarioEvent).map((t) => t.id),
        triggerOptions: this.triggerOptionsFor(scenarioEvent.id),
        otherTriggers: this.otherTriggersFor(scenarioEvent.id),
        latestTests: this.latestTests,
        // a test needs the event on the server
        canTest:
          !this.isAddingScenarioEvent && isEditor && !this.isStarterMsel(),
        eventLabel: this.eventLabel(scenarioEvent.id),
        testPlayerViewId:
          this.msel.automationTestPlayerViewId ?? this.msel.playerViewId,
        deployedPlayerViewId:
          this.msel.status === MselItemStatus.Deployed
            ? this.msel.playerViewId
            : null,
        initialTab,
      } satisfies ScenarioEventEditDialogData,
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.scenarioEvent) {
        this.saveScenarioEvent(result.scenarioEvent);
      }
      // reset the flag indicating a new scenario event
      this.isAddingScenarioEvent = false;
      dialogRef.close();
    });
  }

  /**
   * Reads the MSEL's test runs once, for those who can open its Facilitator View: the API refuses them to anyone
   * else. Called when the MSEL arrives and when the permissions do, whichever is last.
   */
  private loadTestRuns() {
    if (
      !this.msel?.id ||
      this.testRunsLoadedFor === this.msel.id ||
      !canViewFacilitator(
        this.msel,
        this.loggedInUserId(),
        this.permissionDataService.hasPermission(SystemPermission.ViewMsels),
      )
    ) {
      return;
    }
    this.testRunsLoadedFor = this.msel.id;
    this.automationRunDataService.loadByMsel(
      this.msel.id,
      AutomationRunKind.Test,
    );
  }

  eventTasks(scenarioEvent: ScenarioEvent): AutomationTask[] {
    return this.tasksByEvent.get(scenarioEvent.id) ?? [];
  }

  /** "Event 4", by the event's place in the MSEL's own order. */
  eventLabel(scenarioEventId: string): string {
    const index = this.mselScenarioEvents.findIndex(
      (se) => se.id === scenarioEventId,
    );
    return index < 0 ? 'New event' : `Event ${index + 1}`;
  }

  /** The tasks of the MSEL's other events, which one of this event's can be triggered by. */
  triggerOptionsFor(scenarioEventId: string): AutomationTriggerOption[] {
    const options: AutomationTriggerOption[] = [];
    this.mselScenarioEvents
      .filter((se) => se.id !== scenarioEventId)
      .forEach((se) =>
        this.eventTasks(se).forEach((t, i) =>
          options.push({
            id: t.id,
            label: `${this.eventLabel(se.id)} › ${i + 1}. ${t.name}`,
          }),
        ),
      );
    return options;
  }

  /** The triggers of the other events' tasks, for finding a loop before the API refuses one. */
  otherTriggersFor(scenarioEventId: string): Map<string, string | null> {
    const triggers = new Map<string, string | null>();
    this.tasksByEvent.forEach((tasks, eventId) => {
      if (eventId !== scenarioEventId) {
        tasks.forEach((t) => triggers.set(t.id, t.triggerTaskId ?? null));
      }
    });
    return triggers;
  }

  eventTestStatus(scenarioEvent: ScenarioEvent) {
    return overallStatus(
      this.eventTasks(scenarioEvent).map((t) => t.id),
      this.latestTests,
    );
  }

  automationTooltip(scenarioEvent: ScenarioEvent): string {
    const tasks = this.eventTasks(scenarioEvent);
    const names = new Map(
      [...this.tasksByEvent.values()].flat().map((t) => [t.id, t.name]),
    );
    return tasks
      .map(
        (t, i) =>
          `${i + 1}. ${t.name}: ${triggerSummary(t.triggerCondition, names.get(t.triggerTaskId))}${t.enabled ? '' : ' (disabled)'}`,
      )
      .join('\n');
  }

  canTestAutomation(scenarioEvent: ScenarioEvent): boolean {
    return (
      this.eventTasks(scenarioEvent).length > 0 &&
      !this.isStarterMsel() &&
      (this.canEditMsel() ||
        this.msel.hasRole(this.loggedInUserId(), scenarioEvent.id).editor)
    );
  }

  openAutomationTest(scenarioEvent: ScenarioEvent) {
    const tasks = this.eventTasks(scenarioEvent);
    this.dialog.open(AutomationTestDialogComponent, {
      width: '900px',
      maxWidth: '90vw',
      data: {
        mselId: this.msel.id,
        scenarioEventId: scenarioEvent.id,
        eventLabel: this.eventLabel(scenarioEvent.id),
        tasks: tasks.map(draftFromTask),
        savedTaskIds: tasks.map((t) => t.id),
        playerViewId:
          this.msel.automationTestPlayerViewId ?? this.msel.playerViewId,
        deployedPlayerViewId:
          this.msel.status === MselItemStatus.Deployed
            ? this.msel.playerViewId
            : null,
      } satisfies AutomationTestDialogData,
    });
  }

  saveDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string,
    newValue: string,
  ) {
    let dataValue = this.getDataValue(scenarioEvent, dataFieldName);
    if (!dataValue || !dataValue.id) {
      // the dataValue doesn't exist, so create a new one
      const dataFieldId = this.mselDataFields.find(
        (df) => df.name === dataFieldName,
      ).id;
      dataValue = this.newDataValuePlus(scenarioEvent.id, dataFieldId);
      dataValue.value = newValue;
      this.dataValueDataService.add(dataValue);
    } else {
      dataValue.value = newValue;
      this.dataValueDataService.updateDataValue(dataValue);
    }
  }

  saveDataValueArray(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string,
    newValues: string[],
  ) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    let dataValue = this.getDataValue(scenarioEvent, dataFieldName);
    if (!dataValue || !dataValue.id) {
      // the dataValue doesn't exist, so create a new one
      const dataFieldId = this.mselDataFields.find(
        (df) => df.name === dataFieldName,
      ).id;
      dataValue = this.newDataValuePlus(scenarioEvent.id, dataFieldId);
      dataValue.value = newValues.join(', ');
      dataValue.valueArray = newValues;
      this.dataValueDataService.add(dataValue);
    } else {
      dataValue.value = newValues.join(', ');
      dataValue.valueArray = newValues;
      this.dataValueDataService.updateDataValue(dataValue);
    }
  }

  saveScenarioEvent(scenarioEvent: ScenarioEvent) {
    if (this.isAddingScenarioEvent) {
      this.scenarioEventDataService.add(scenarioEvent);
    } else {
      this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
    }
  }

  saveIntegrationTarget(scenarioEvent: ScenarioEvent, value: string) {
    scenarioEvent.integrationTarget = value;
    this.saveScenarioEvent(scenarioEvent);
  }

  getIntegrationTargetArray(scenarioEvent: ScenarioEvent): string[] {
    return scenarioEvent.integrationTarget
      ? scenarioEvent.integrationTarget.split(', ').filter((s) => s.length > 0)
      : [];
  }

  onIntegrationTargetChange(scenarioEvent: ScenarioEvent, newValues: string[]) {
    this.saveIntegrationTarget(scenarioEvent, newValues.join(', '));
  }

  setHiddenScenarioEvent(scenarioEvent: ScenarioEvent, value: boolean) {
    scenarioEvent.isHidden = value;
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  deleteScenarioEvent(scenarioEvent: ScenarioEvent, index: number): void {
    this.dialogService
      .confirm({
        title: 'Delete Event',
        message: 'Are you sure that you want to delete event ' + index + '?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.scenarioEventDataService.delete(scenarioEvent.id);
        }
      });
  }

  batchDeleteScenarioEvents() {
    this.dialogService
      .confirm({
        title: 'Delete Selected Events',
        message: 'Are you sure that you want to delete the selected events?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.scenarioEventDataService.batchDelete(this.selectedEventIdList);
          this.selectedEventIdList = [];
          this.allSelected = false;
        }
      });
  }

  notValidDateFormat(dateString: string) {
    // only check if there is a value
    if (dateString && dateString.length === 0) {
      return false;
    }
    // check for month/day/year format
    const regexPattern =
      /^(0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d$/;
    return !regexPattern.test(dateString);
  }

  verifyNumber(newValue: DataValuePlus) {
    if (!newValue || !newValue.value) {
      return;
    }
    // remove non numeric characters, but allow '.' and '-'
    newValue.value = newValue.value.replace(/[^\d.-]/g, '');
  }

  getRgbValues(rowMetadata: string) {
    const parts = rowMetadata ? rowMetadata.split(',') : [];
    const rgbValues =
      parts.length >= 4 ? parts[1] + ', ' + parts[2] + ', ' + parts[3] : '';
    return rgbValues;
  }

  getStyleFromColor(color: string) {
    const tint =
      this.userTheme() === 'dark-theme'
        ? this.darkThemeTint
        : this.lightThemeTint;
    return color
      ? { 'background-color': 'rgba(' + color + ', ' + tint + ')' }
      : {};
  }

  getRowStyle(scenarioEvent: ScenarioEvent) {
    if (!scenarioEvent || !scenarioEvent.rowMetadata) {
      return '';
    }
    const color = this.getRgbValues(scenarioEvent.rowMetadata);
    return this.getStyleFromColor(color);
  }

  selectNewColor(color: string, incomingScenarioEvent: ScenarioEvent) {
    const scenarioEvent = { ...incomingScenarioEvent };
    let parts = scenarioEvent.rowMetadata
      ? scenarioEvent.rowMetadata.split(',')
      : [];
    // update the scenario event row metadata
    if (parts.length === 0) {
      const rowHeight = this.settingsService.settings.DefaultXlsxRowHeight
        ? this.settingsService.settings.DefaultXlsxRowHeight
        : 15;
      scenarioEvent.rowMetadata = rowHeight + ',' + color;
    } else {
      scenarioEvent.rowMetadata = parts[0] + ',' + color;
    }
    // convert color to hex value
    let hexColor = '';
    let tint = '';
    if (!color) {
      hexColor = '';
      tint = '';
    } else {
      const colorParts = color.split(',');
      // convert decimal value to hex
      for (let i = 0; i < colorParts.length; i++) {
        colorParts[i] = (+colorParts[i]).toString(16).trim();
        colorParts[i] =
          colorParts[i].length < 2 ? '0' + colorParts[i] : colorParts[i];
      }
      hexColor = colorParts.join('');
      tint = '0.7'; // 0.7 seems to be the correct amount to make excel look right
    }
    // convert decimal value to hex
    this.dataValues
      .filter((dv) => dv.scenarioEventId === scenarioEvent.id)
      .forEach((dv) => {
        parts = dv.cellMetadata
          ? dv.cellMetadata.split(',')
          : ['', '', 'normal', '0'];
        parts[0] = hexColor;
        parts[1] = tint;
        dv.cellMetadata = parts.join(',');
      });
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  batchSelectNewColor(color: string) {
    this.selectedEventIdList.forEach((id) => {
      const scenarioEvent = this.displayedScenarioEvents.find(
        (e) => e.id === id,
      );
      this.selectNewColor(color, scenarioEvent);
    });
  }

  getStyle(dataField: DataField): string {
    if (dataField && dataField.columnMetadata) {
      const width = Math.trunc(+dataField.columnMetadata * 7); // 7 converts excel widths to http widths
      return 'text-align: left; width: ' + width.toString() + 'px;';
    } else if (dataField.dataType.toString() === 'DateTime') {
      return 'width: max-content';
    } else {
      return 'text-align: left; width: 90%; min-width: 40px;';
      // return 'width: 100%;';
    }
  }

  getSelectedState(id: string): boolean {
    const isSelected = this.selectedEventIdList.some((e) => e === id);
    return isSelected;
  }

  setSelectedState(id: string, newValue: boolean) {
    if (newValue) {
      this.selectedEventIdList.push(id);
    } else {
      const index = this.selectedEventIdList.indexOf(id);
      if (index > -1) {
        this.selectedEventIdList.splice(index, 1);
      }
    }
  }

  setAllSelectedState(newValue: boolean) {
    this.selectedEventIdList = [];
    this.allSelected = newValue;
    if (newValue) {
      this.displayedScenarioEvents.forEach((e) => {
        this.selectedEventIdList.push(e.id);
      });
    }
  }

  setSearch(value: boolean) {
    if (!value) {
      this.applyFilter('');
    }
    this.showSearch = value;
  }

  setRealTime(value: boolean) {
    this.showRealTime = value;
    this.uiDataService.setUseRealTime(value);
  }

  openContent(id: string) {
    const url =
      document.baseURI +
      '/eventdetail?msel=' +
      this.msel.id +
      '&scenarioEvent=' +
      id;
    window.open(url);
  }

  selectFromCatalog(catalog: Catalog) {
    this.injectmDataService.loadByCatalog(catalog.id);
    const dialogRef = this.dialog.open(InjectSelectDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      height: '90%',
      data: {
        catalog: catalog,
        loggedInUserId: this.loggedInUserId(),
        isContentDeveloper: this.canEditMsel(),
        injectList: [],
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.selectedInjectIdList.length > 0) {
        const createFromInjectsForm = {
          injectIdList: result.selectedInjectIdList,
          injectTypeId: catalog.injectTypeId,
          mselId: this.msel.id,
          addDataFields: true,
        } as CreateFromInjectsForm;
        this.scenarioEventDataService.addInjects(createFromInjectsForm);
      }
      // reset the flag indicating a new scenario event
      this.isAddingScenarioEvent = false;
      dialogRef.close();
    });
  }

  rowDataFields(scenarioEvent: ScenarioEvent): DataField[] {
    const dataFields = new Array<DataField>();
    this.mselDataFields.forEach((df) => {
      if (
        (scenarioEvent.scenarioEventType === EventType.Inject &&
          df.onScenarioEventList) ||
        (scenarioEvent.scenarioEventType === EventType.Information &&
          df.isInformationField) ||
        (scenarioEvent.scenarioEventType === EventType.Facilitation &&
          df.isFacilitationField)
      ) {
        dataFields.push(df);
      }
    });
    return dataFields;
  }

  copyToAnotherMsel() {
    const dialogRef = this.dialog.open(ScenarioEventCopyDialogComponent, {
      maxWidth: '90vw',
      width: 'auto',
      height: '90%',
      data: {
        mselList: this.mselListForCopy,
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.mselId) {
        this.scenarioEventDataService.copyScenarioEventsToMsel(
          result.mselId,
          this.selectedEventIdList,
        );
      }
      dialogRef.close();
    });
  }

  shouldShowMoveSeparators(): boolean {
    if (!this.sort || !this.sort.active || !this.sort.direction) return true;
    if (this.sort.direction !== 'asc') return false;
    return (
      this.sort.active === 'moveNumber' || this.sort.active === 'deltaSeconds'
    );
  }

  isMoveStartRow(rowIndex: number): boolean {
    if (!this.shouldShowMoveSeparators()) return false;
    const events = this.displayedScenarioEvents;
    const currMove = this.moveAndGroupNumbers[events[rowIndex].id]?.[0];
    if (currMove == null || currMove < 0) return false;
    if (rowIndex === 0) return true;
    const prevMove = this.moveAndGroupNumbers[events[rowIndex - 1].id]?.[0];
    return currMove !== prevMove;
  }

  getMoveLabel(rowIndex: number): string {
    const events = this.displayedScenarioEvents;
    const moveNum = this.moveAndGroupNumbers[events[rowIndex].id]?.[0];
    const move = this.moveList.find((m) => +m.moveNumber === +moveNum);
    const desc = move?.description?.trim();
    return desc ? `Start Move ${moveNum} — ${desc}` : `Start Move ${moveNum}`;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
