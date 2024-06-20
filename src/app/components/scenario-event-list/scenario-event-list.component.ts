// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { CdkDragDrop, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { takeUntil, map, debounceTime, distinctUntilChanged, mergeMap, delay } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  Card,
  DataField,
  DataFieldType,
  DataOption,
  DataValue,
  MselItemStatus,
  Move,
  MselRole,
  Organization,
  ScenarioEvent,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CardQuery } from 'src/app/data/card/card.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { ScenarioEventDataService, ScenarioEventPlus, DataValuePlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventEditDialogComponent } from '../scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataOptionQuery } from 'src/app/data/data-option/data-option.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-scenario-event-list',
  templateUrl: './scenario-event-list.component.html',
  styleUrls: ['./scenario-event-list.component.scss'],
})
export class ScenarioEventListComponent implements OnDestroy  {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() userTheme: Theme;
  msel = new MselPlus();
  mselScenarioEvents: ScenarioEvent[] = [];
  mselScenarioEvtIndex = new Map<string, number>();
  expandedScenarioEventId = '';
  expandedMoreScenarioEventIds: string[] = [];
  filterString = '';
  sort: Sort = { active: '', direction: ''};
  displayedScenarioEvents: ScenarioEventPlus[] = [];
  sortedDataFields: DataField[] = [];
  sortedDataOptions: DataOption[] = [];
  allDataFields: DataField[] = [];
  dataValues: DataValue[] = [];
  newScenarioEvent: ScenarioEventPlus;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
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
    sanitize: true,
  };
  dataType: typeof DataFieldType = DataFieldType;
  sortableDataTypes = [DataFieldType.String, DataFieldType.Integer, DataFieldType.Double, DataFieldType.Boolean,
    DataFieldType.DateTime, DataFieldType.Organization, DataFieldType.Card, DataFieldType.Move,
    DataFieldType.SourceType, DataFieldType.Status, DataFieldType.Team, DataFieldType.TeamsMultiple,
    DataFieldType.Checkbox, DataFieldType.User, DataFieldType.Url, DataFieldType.DeliveryMethod];
  dateFormControls = new Map<string, UntypedFormControl>();
  itemStatus = [MselItemStatus.Pending, MselItemStatus.Entered, MselItemStatus.Approved, MselItemStatus.Complete,
    MselItemStatus.Deployed, MselItemStatus.Archived];
  mselRole = { Owner: MselRole.Owner, Approver: MselRole.Approver, Editor: MselRole.Editor};
  organizationList: Organization[] = [];
  mselUsers: User[] = [];
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: []
  } as DataValuePlus;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  scenarioEventBackgroundColors: Array<string>;
  darkThemeTint = this.settingsService.settings.DarkThemeTint ? this.settingsService.settings.DarkThemeTint : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint ? this.settingsService.settings.LightThemeTint : 0.4;
  cardList: Card[] = [];
  moveList: Move[] = [];
  teamList: Team[] = [];
  keyUp = new Subject<KeyboardEvent>();
  private subscription: Subscription;
  selectedEventIdList: string[] = [];
  showSearch = false;
  showRealTime = false;
  allowDragAndDrop = true;
  moveAndGroupNumbers: Record<string, number[]>[] = [];

  constructor(
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private cardQuery: CardQuery,
    private moveQuery: MoveQuery,
    private mselQuery: MselQuery,
    private organizationQuery: OrganizationQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    public dialogService: DialogService,
    public dialog: MatDialog,
    private dataFieldQuery: DataFieldQuery,
    private dataOptionQuery: DataOptionQuery,
    private dataValueDataService: DataValueDataService,
    private dataValueQuery: DataValueQuery,
    private teamQuery: TeamQuery,
    private uiDataService: UIDataService
  ) {
    this.scenarioEventBackgroundColors = this.settingsService.settings.ScenarioEventBackgroundColors;
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
        if (msel && this.msel.id !== msel.id) {
          this.msel = this.getEditableMsel(msel) as MselPlus;
          this.mselUsers = this.getMselUsers();
        }
      });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataFields => {
        this.getSortedDataFields(dataFields);
      });
    // subscribe to the data options
    this.dataOptionQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataOptions => {
      this.sortedDataOptions = dataOptions.sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
      });
    // subscribe to data values
    this.dataValueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataValues => {
        this.dataValues = [];
      dataValues.forEach(dv => {
        this.dataValues.push({ ... dv });
        });
      });
    // subscribe to scenario events
    (this.scenarioEventQuery.selectAll()).pipe(takeUntil(this.unsubscribe$)).subscribe(scenarioEvents => {
      [this.mselScenarioEvents, this.mselScenarioEvtIndex] = this.getEditableScenarioEvents(scenarioEvents);
      if (scenarioEvents && scenarioEvents.length > 0) {
        this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(this.mselScenarioEvents, this.moveList);
        this.displayedScenarioEvents = this.scenarioEventDataService.sortAndFilterScenarioEvents(
          scenarioEvents, this.sortedDataFields, this.dataValues, this.cardList, this.mselUsers, this.sort, this.filterString, true);
      }
    });
    // is user a contentdeveloper or system admin?
    this.userDataService.isContentDeveloper.pipe(takeUntil(this.unsubscribe$)).subscribe((isOne) => {
        this.canDoAnything = isOne;
      });
    // subscribe to organizations
    this.organizationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(organizations => {
      this.organizationList = organizations.filter(org => !org.isTemplate && org.mselId === this.msel.id);
      });
    // observe the Cards
    this.cardQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(cards => {
        this.cardList = cards;
      });
    // observe the Moves
    this.moveQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(moves => {
      this.moveList = moves.sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);
      this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(this.mselScenarioEvents, this.moveList);
      });
    // observe the Teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
        this.teamList = teams;
      });
    // subscribe to filter string changes for debounce
    this.subscription = this.keyUp.pipe(
        debounceTime(250),
        distinctUntilChanged(),
      mergeMap(search => of(search).pipe(
        delay(250),
      )),
    ).subscribe(event => {
        this.applyFilter(this.filterString);
      });
    // set the time display format
    this.showRealTime = this.uiDataService.useRealTime();
  }

  tabChange(event) {
    const injectData = event.tab.textLabel.toLowerCase().replace(' ', '');
    this.router.navigate([], {
      queryParams: { injectData: injectData },
      queryParamsHandling: 'merge'
    });
  }

  getEditableMsel (msel: MselPlus): MselPlus {
    const editableMsel = new MselPlus();
    Object.assign(editableMsel, msel);
    editableMsel.teams = editableMsel.teams.slice(0).sort((a, b) => a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1);

    return editableMsel;
  }

  getEditableScenarioEvents(scenarioEvents: ScenarioEvent[]): [ScenarioEvent[], Map<string, number>] {
    const editableList: ScenarioEvent[] = [];
    const evtIndex = new Map<string, number>();
    scenarioEvents.forEach((scenarioEvent, index) => {
      const newScenarioEvent = { ...scenarioEvent};
      editableList.push(newScenarioEvent);
      evtIndex.set(newScenarioEvent.id, index);
    });

    return [editableList, evtIndex];
  }

  getSortedDataFields(dataFields: DataField[]) {
    if (dataFields) {
      this.sortedDataFields = dataFields
        .filter(df => df.onScenarioEventList)
        .sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
      this.allDataFields = dataFields
        .sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    // create date form controls
    this.allDataFields.forEach(df => {
      if (df.dataType === DataFieldType.DateTime) {
        this.dateFormControls[df.id] = new UntypedFormControl();
      }
    });
  }

  getDataOptions(dataFieldId: string) {
    return this.sortedDataOptions.filter(x => x.dataFieldId === dataFieldId);
  }

  getMselUsers(): User[] {
    let users = [];
    this.msel.teams.forEach(team => {
      team.users.forEach(user => {
        users.push({... user});
      });
    });
    users = users.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
    return users;
  }

  toggleNoneSelection(scenarioEvent: ScenarioEventPlus, dataFieldName: string) {
    const newValues = new Array('None');
    this.getDataValue(scenarioEvent, dataFieldName).value = newValues.join(', ');
    this.getDataValue(scenarioEvent, dataFieldName).valueArray = newValues;
    this.dataValueDataService.updateDataValue(this.getDataValue(scenarioEvent, dataFieldName));
  }

  trackByFn(index, item) {
    return item.id;
  }

  getSortedOrganizationOptions(): string[] {
    let orgs: string[] = [];
    this.organizationList.forEach(o => {
      orgs.push(o.shortName);
    });
    this.msel.teams.forEach(t => {
      orgs.push(t.shortName);
    });
    orgs = orgs.sort((a, b) => a < b ? -1 : 1);
    return orgs;
  }

  getSortedTeamOptions(): string[] {
    let orgs: string[] = [];
    this.msel.teams.forEach(t => {
      orgs.push(t.shortName);
    });
    orgs = orgs.sort((a, b) => a < b ? -1 : 1);
    return orgs;
  }

  scroll(id) {
    const el = document.getElementById(id);
    el.scrollIntoView();
  }

  selectMoreScenarioEvent(id: string) {
    const expandedIndex = this.expandedMoreScenarioEventIds.findIndex(seId => seId === id);
    if (expandedIndex === -1) {
      this.expandedMoreScenarioEventIds.push(id);
    } else {
      this.expandedMoreScenarioEventIds.splice(expandedIndex, 1);
    }
  }

  blankDataValuePlus(): DataValuePlus {
    const bdvp = {
      id: '',
      scenarioEventId: '',
      dataFieldId: '',
      value: '',
      valueArray: []
    } as DataValuePlus;

    return bdvp;
  }

  newDataValuePlus(scenarioEventId: string, dataFieldId: string): DataValuePlus {
    const ndvp = {
      id: uuidv4(),
      scenarioEventId: scenarioEventId,
      dataFieldId: dataFieldId,
      value: '',
      valueArray: []
    } as DataValuePlus;

    return ndvp;
  }

  getDataValue(scenarioEvent: ScenarioEventPlus, dataFieldName: string): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    const dataFieldId = this.getDataFieldIdByName(scenarioEvent, dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    let dataValuePlus = this.dataValues.find(dv =>
      dv.dataFieldId === dataFieldId && dv.scenarioEventId === scenarioEvent.id) as DataValuePlus;
    if (dataValuePlus) {
      dataValuePlus.valueArray = dataValuePlus.value ? dataValuePlus.value.split(', ') : [];
    } else {
      dataValuePlus = this.blankDataValue;
    }
    return dataValuePlus;
  }

  getDataFieldIdByName(scenarioEvent: ScenarioEventPlus, name: string): string {
    const dataField = this.allDataFields.find(df => df.name.toLowerCase() === name.toLowerCase());
    return dataField ? dataField.id : '';
  }

  getFilteredDataFields(filter: string): DataField[] {
    let filteredList = [];
    switch (filter) {
      case 'Default':
        filteredList = this.allDataFields.filter(x => !x.isInitiallyHidden);
        break;
      case 'Gallery':
        filteredList = this.allDataFields.filter(x => !!x.galleryArticleParameter);
        break;
      default:
        filteredList = this.allDataFields;
    }
    filteredList =  filteredList.sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
    return filteredList;
  }

  getTeamShortName(teamId: string) {
    if (!teamId) {
      return '';
    }
    const team = this.teamList.find(t => t.id === teamId);
    return team ? team.shortName : '';
  }

  onContextMenu(event: MouseEvent, scenarioEvent: ScenarioEventPlus) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.menuData = { item: scenarioEvent };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.displayedScenarioEvents = this.scenarioEventDataService.sortAndFilterScenarioEvents(
      this.mselScenarioEvents, this.sortedDataFields, this.dataValues, this.cardList, this.mselUsers, this.sort, this.filterString, true);
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.displayedScenarioEvents = this.scenarioEventDataService.sortAndFilterScenarioEvents(
      this.mselScenarioEvents, this.sortedDataFields, this.dataValues, this.cardList, this.mselUsers, this.sort, this.filterString, true);
    this.allowDragAndDrop = !this.sort.active || this.sort.direction === '';
  }

  dropHandler(event: CdkDragDrop<string[]>) {
    // defaultOffsetSecs is the amount of time to offset a new group that is before or after all others
    const defaultOffsetSecs = 3600;
    if (event.previousIndex !== event.currentIndex) {  // sanity check
      const droppedScenarioEvt = event.item.data;
      const droppedScenarioEvtIdx = this.mselScenarioEvtIndex.get(droppedScenarioEvt.id);
      const targetScenarioEvtId = this.displayedScenarioEvents[event.currentIndex].id;
      const targetScenarioEvtIdx = this.mselScenarioEvtIndex.get(targetScenarioEvtId);
      const targetScenarioEvt = this.mselScenarioEvents[targetScenarioEvtIdx];
      const movedDown = droppedScenarioEvtIdx < targetScenarioEvtIdx;
      const origOffset = +droppedScenarioEvt.deltaSeconds;
      const origGroupOrder = +droppedScenarioEvt.groupOrder;
      let newOffset = origOffset;
      let newGrpOrder = origGroupOrder;
      // case where we moved the event to the top of the MSEL
      if (0 === targetScenarioEvtIdx) {
        const prevOffset = +this.mselScenarioEvents[targetScenarioEvtIdx].deltaSeconds;
        if (prevOffset > 0) {
          newOffset = Math.max(prevOffset - defaultOffsetSecs, 0);
        } else {
          newOffset = prevOffset;
        }
        newGrpOrder = newOffset === prevOffset ? +targetScenarioEvt.groupOrder : 0;
      // case where we moved the event to the bottom of the MSEL
      } else if (targetScenarioEvtIdx === this.mselScenarioEvents.length - 1) {
        newOffset = +this.mselScenarioEvents[targetScenarioEvtIdx].deltaSeconds + defaultOffsetSecs;
        newGrpOrder = 0;
      // case where we moved the event somewhere in the middle of the MSELs
      } else {
        const aboveIndex = movedDown ? targetScenarioEvtIdx : targetScenarioEvtIdx - 1;
        const belowIndex = aboveIndex + 1;
        const aboveOffset = +this.mselScenarioEvents[aboveIndex].deltaSeconds;
        const belowOffset = +this.mselScenarioEvents[belowIndex].deltaSeconds;

        const timeDiff = belowOffset - aboveOffset;
        if (timeDiff > 1) {
          newOffset = belowOffset + Math.floor(timeDiff / 2);
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

  dragStart(event: CdkDragStart) {
  }

  dragEnd(event: CdkDragEnd) {
  }

  addScenarioEvent() {
    const newScenarioEvent = this.createBlankScenarioEvent();
    this.isAddingScenarioEvent = true;
    this.displayEditDialog(newScenarioEvent);
  }

  editScenarioEvent(scenarioEvent: ScenarioEvent) {
    const editScenarioEvent = {... scenarioEvent};
    editScenarioEvent.dataValues = [];
    const seDataValues = this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id);
    this.allDataFields.forEach(df => {
      let dataValue = seDataValues.find(dv => dv.dataFieldId === df.id);
      if (!dataValue) {
        dataValue = this.newDataValuePlus(scenarioEvent.id, df.id);
      }
      editScenarioEvent.dataValues.push({ ...dataValue });
    });
    this.displayEditDialog(editScenarioEvent);
  }

  copyScenarioEvent(scenarioEvent: ScenarioEventPlus): void {
    const newScenarioEvent = {... scenarioEvent};
    newScenarioEvent.id = uuidv4();
    newScenarioEvent.dataValues = [];
    this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .forEach(dv => {
        newScenarioEvent.dataValues.push({
          id: uuidv4(),
          dataFieldId: dv.dataFieldId,
          scenarioEventId: newScenarioEvent.id,
          value: dv.value
        });
      });
    this.isAddingScenarioEvent = true;
    this.displayEditDialog(newScenarioEvent);
  }

  displayEditDialog(scenarioEvent: ScenarioEvent) {
    const isOwner = this.isContentDeveloper || this.msel.hasRole(this.loggedInUserId, scenarioEvent.id).owner;
    const isApprover = isOwner || this.msel.hasRole(this.loggedInUserId, scenarioEvent.id).approver;
    const isEditor = isApprover || this.msel.hasRole(this.loggedInUserId, scenarioEvent.id).editor;
    const dialogRef = this.dialog.open(ScenarioEventEditDialogComponent, {
      width: '80%',
      maxWidth: '800px',
      height: '90%',
      data: {
        scenarioEvent: scenarioEvent,
        dataFields: this.allDataFields,
        dataOptions: this.sortedDataOptions,
        organizationList: this.getSortedOrganizationOptions(),
        teamList: this.msel.teams,
        moveList: this.moveList,
        cardList: this.cardList,
        gallerySourceTypes: this.msel.gallerySourceTypes,
        isNew: this.isAddingScenarioEvent,
        isOwner: isOwner,
        isApprover: isApprover,
        isEditor: isEditor,
        useCite: this.msel.useCite,
        useGallery: this.msel.useGallery,
        useSteamfitter: this.msel.useSteamfitter,
        userList: this.mselUsers,
        mselStartTime: this.msel.startTime
      },
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

  createBlankScenarioEvent(): ScenarioEvent {
    const seId = uuidv4();
    const newScenarioEvent = {
      id: seId,
      mselId: this.msel.id,
      status: MselItemStatus.Pending,
      dataValues: [],
      plusDataValues: []
    };
    this.allDataFields.forEach(df => {
      newScenarioEvent.dataValues.push({
        dataFieldId: df.id,
        id: uuidv4(),
        scenarioEventId: seId,
        value: ''
      });
    });
    return newScenarioEvent;
  }

  saveDataValue(scenarioEvent: ScenarioEventPlus, dataFieldName: string, newValue: string) {
    let dataValue = this.getDataValue(scenarioEvent, dataFieldName);
    if (!dataValue || !dataValue.id) {
      // the dataValue doesn't exist, so create a new one
      const dataFieldId = this.allDataFields.find(df => df.name === dataFieldName).id;
      dataValue = this.newDataValuePlus(scenarioEvent.id, dataFieldId);
      dataValue.value = newValue;
      this.dataValueDataService.add(dataValue);
    } else {
      dataValue.value = newValue;
      this.dataValueDataService.updateDataValue(dataValue);
    }
  }

  saveDataValueArray(scenarioEvent: ScenarioEventPlus, dataFieldName: string, newValues: string[]) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    let dataValue = this.getDataValue(scenarioEvent, dataFieldName);
    if (!dataValue || !dataValue.id) {
      // the dataValue doesn't exist, so create a new one
      const dataFieldId = this.allDataFields.find(df => df.name === dataFieldName).id;
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

  setHiddenScenarioEvent(scenarioEvent: ScenarioEvent, value: boolean) {
    scenarioEvent.isHidden = value;
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  deleteScenarioEvent(scenarioEvent: ScenarioEvent): void {
    this.dialogService
      .confirm(
        'Delete Event',
        'Are you sure that you want to delete this event?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.scenarioEventDataService.delete(scenarioEvent.id);
        }
      });
  }

  batchDeleteScenarioEvents() {
    this.dialogService
      .confirm(
        'Delete ALL selected Events!',
        'Are you sure that you want to delete the selected events?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.scenarioEventDataService.batchDelete(this.selectedEventIdList);
          this.selectedEventIdList = [];
        }
      });
  }

  notValidDateFormat(dateString: string) {
    // only check if there is a value
    if (dateString && dateString.length === 0) {
      return false;
    }
    // check for month/day/year format
    const regexPattern = /^(0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d$/;
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
    const rgbValues = parts.length >= 4 ? parts[1] + ', ' + parts[2] + ', ' + parts[3] : '';
    return rgbValues;
  }

  getStyleFromColor(color: string) {
    const tint = this.userTheme === 'dark-theme' ? this.darkThemeTint : this.lightThemeTint;
    return color ? {'background-color': 'rgba(' + color + ', ' + tint + ')'} : {};
  }

  getRowStyle(scenarioEvent: ScenarioEventPlus) {
    if (!scenarioEvent || !scenarioEvent.rowMetadata) {
      return '';
    }
    const color = this.getRgbValues(scenarioEvent.rowMetadata);
    return this.getStyleFromColor(color);
  }

  selectNewColor(color: string, incomingScenarioEvent: ScenarioEventPlus) {
    const scenarioEvent = {... incomingScenarioEvent};
    let parts = scenarioEvent.rowMetadata ? scenarioEvent.rowMetadata.split(',') : [];
    // update the scenario event row metadata
    if (parts.length === 0) {
      const rowHeight = this.settingsService.settings.DefaultXlsxRowHeight ? this.settingsService.settings.DefaultXlsxRowHeight : 15;
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
        colorParts[i] = colorParts[i].length < 2 ? '0' + colorParts[i] : colorParts[i];
      }
      hexColor = colorParts.join('');
      tint = '0.7';  // 0.7 seems to be the correct amount to make excel look right
    }
    // convert decimal value to hex
    this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .forEach(dv => {
        parts = dv.cellMetadata ? dv.cellMetadata.split(',') : ['', '', 'normal', '0'];
        parts[0] = hexColor;
        parts[1] = tint;
        dv.cellMetadata = parts.join(',');
      });
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  batchSelectNewColor(color: string) {
    this.selectedEventIdList.forEach(id => {
      const scenarioEvent = this.displayedScenarioEvents.find(e => e.id === id);
      this.selectNewColor(color, scenarioEvent);
    });
  }

  getStyle(dataField: DataField): string {
    if (dataField && dataField.columnMetadata) {
      const width = Math.trunc(+dataField.columnMetadata * 7);  // 7 converts excel widths to http widths
      return 'text-align: left; width: ' + width.toString() + 'px;';
    } else if (dataField.dataType.toString() === 'DateTime') {
      return 'width: max-content';
    } else {
      return 'text-align: left; width: 90%; min-width: 40px;';
      // return 'width: 100%;';
    }
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    const dataField = this.allDataFields.find(df => df.name === columnName);
    if (!dataField) {
      return '';
    }
    const dataValue = this.dataValues.find(dv => dv.dataFieldId === dataField.id && dv.scenarioEventId === scenarioEvent.id);
    return dataValue && dataValue.value != null ? dataValue.value : ' ';
  }

  getScenarioEventDateValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    const dataField = this.allDataFields.find(df => df.name === columnName);
    if (!dataField) {
      return '';
    }
    const dataValue = this.dataValues.find(dv => dv.dataFieldId === dataField.id && dv.scenarioEventId === scenarioEvent.id);
    const dateValue = dataValue && dataValue.value != null ? dataValue.value : ' ';
    const formattedValue = new Date(dateValue).toLocaleString();
    return formattedValue === 'Invalid Date' ? ' ' : formattedValue;
  }

  getSelectedState(id: string): boolean {
    const isSelected = this.selectedEventIdList.some(e => e === id);
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
    if (newValue) {
      this.displayedScenarioEvents.forEach(e => {
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
    const url = location.origin + '/injectpage?msel=' + this.msel.id + '&scenarioEvent=' + id;
    window.open(url);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
