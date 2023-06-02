// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  Card,
  DataField,
  DataFieldType,
  DataValue,
  ItemStatus,
  Move,
  MselRole,
  Organization,
  ScenarioEvent,
  Team,
  User
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CardQuery } from 'src/app/data/card/card.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { ScenarioEventDataService, ScenarioEventPlus, DataValuePlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventEditDialogComponent } from '../scenario-event-edit-dialog/scenario-event-edit-dialog.component';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { TeamQuery } from 'src/app/data/team/team.query';

@Component({
  selector: 'app-scenario-event-list',
  templateUrl: './scenario-event-list.component.html',
  styleUrls: ['./scenario-event-list.component.scss'],
})
export class ScenarioEventListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() userTheme: Theme;
  msel = new MselPlus();
  mselScenarioEvents: ScenarioEventPlus[] = [];
  expandedScenarioEventId = '';
  expandedMoreScenarioEventIds: string[] = [];
  filteredScenarioEventList: ScenarioEventPlus[] = [];
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedScenarioEvents: ScenarioEventPlus[] = [];
  sortedDataFields: DataField[] = [];
  allDataFields: DataField[] = [];
  dataValues: DataValue[] = [];
  newScenarioEvent: ScenarioEventPlus;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
  editorStyle = {
    'min-height': '100px',
    'max-height': '400px',
    'overflow': 'auto'
  };
  dataType: typeof DataFieldType = DataFieldType;
  dateFormControls = new Map<string, UntypedFormControl>();
  itemStatus: ItemStatus[] = [ItemStatus.Pending, ItemStatus.Entered, ItemStatus.Approved, ItemStatus.Complete];
  mselRole = { Owner: MselRole.Owner, Approver: MselRole.Approver, Editor: MselRole.Editor};
  organizationList: Organization[] = [];
  mselUsers: User[] = [];
  blankDataValue = {
    id: '',
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

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private cardQuery: CardQuery,
    private moveQuery: MoveQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private organizationQuery: OrganizationQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    public dialogService: DialogService,
    public dialog: MatDialog,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private dataOptionDataService: DataOptionDataService,
    private dataValueDataService: DataValueDataService,
    private dataValueQuery: DataValueQuery,
    private organizationDataService: OrganizationDataService,
    private teamQuery: TeamQuery
  ) {
    // subscribe to route changes
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      // set the selected tab based on the injectData
      const mselId = params.get('msel');
      if (!mselId) {
        this.mselDataService.setActive('');
      } else if (!this.msel || this.msel.id !== mselId) {
        this.mselDataService.setActive(mselId);
      }
    });
    this.scenarioEventBackgroundColors = this.settingsService.settings.ScenarioEventBackgroundColors;
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && (!this.msel || this.msel.id !== msel.id)) {
        this.msel = this.getEditableMsel(msel) as MselPlus;
        this.mselUsers = this.getMselUsers();
        this.dataFieldDataService.loadByMsel(msel.id);
        this.dataValueDataService.loadByMsel(msel.id);
        this.scenarioEventDataService.loadByMsel(msel.id);
        this.organizationDataService.loadByMsel(msel.id);
      }
    });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataFields => {
      this.getSortedDataFields(dataFields);
      dataFields.forEach(df => {
        if (df.isChosenFromList) {
          this.dataOptionDataService.loadByDataField(df.id);
        }
      });
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
      this.mselScenarioEvents = this.getEditableScenarioEvents(scenarioEvents as ScenarioEventPlus[]);
      this.filteredScenarioEventList = this.getFilteredScenarioEvents(this.mselScenarioEvents);
      this.sortedScenarioEvents = this.getSortedScenarioEvents(this.filteredScenarioEventList);
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
    });
    // observe the Teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
    });
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

  getEditableScenarioEvents(scenarioEvents: ScenarioEventPlus[]): ScenarioEventPlus[] {
    const editableList: ScenarioEventPlus[] = [];
    scenarioEvents.forEach(scenarioEvent => {
      const newScenarioEvent = { ...scenarioEvent};
      editableList.push(newScenarioEvent);
    });

    return editableList;
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEventPlus[]): ScenarioEventPlus[] {
    let sortedScenarioEvents: ScenarioEventPlus[];
    if (scenarioEvents) {
      if (scenarioEvents.length > 0 && this.sort && this.sort.direction) {
        sortedScenarioEvents = (scenarioEvents as ScenarioEventPlus[])
          .sort((a: ScenarioEventPlus, b: ScenarioEventPlus) => this.sortScenarioEvents(a, b, this.sort.active, this.sort.direction));
      } else {
        sortedScenarioEvents = (scenarioEvents as ScenarioEventPlus[])
          .sort((a, b) => +a.rowIndex > +b.rowIndex ? 1 : -1);
      }
    }
    return sortedScenarioEvents;
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

  getMselUsers(): User[] {
    let users = [];
    this.teamList.forEach(team => {
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
    this.teamList.forEach(t => {
      orgs.push(t.shortName);
    });
    orgs = orgs.sort((a, b) => a < b ? -1 : 1);
    return orgs;
  }

  getSortedTeamOptions(): string[] {
    let orgs: string[] = [];
    this.teamList.forEach(t => {
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

  getDataValue(scenarioEvent: ScenarioEventPlus, dataFieldName: string): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    const dataFieldId = this.getDataFieldIdByName(scenarioEvent, dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    const dataValuePlus = this.dataValues.find(dv =>
      dv.dataFieldId === dataFieldId && dv.scenarioEventId === scenarioEvent.id) as DataValuePlus;
    if (dataValuePlus && dataValuePlus) {
      dataValuePlus.valueArray = dataValuePlus.value ? dataValuePlus.value.split(', ') : [];
    }
    return dataValuePlus ? dataValuePlus : this.blankDataValue;
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

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.filteredScenarioEventList = this.getFilteredScenarioEvents(this.mselScenarioEvents);
    this.sortedScenarioEvents = this.getSortedScenarioEvents(this.filteredScenarioEventList);
  }

  private sortScenarioEvents(
    a: ScenarioEventPlus,
    b: ScenarioEventPlus,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    return (
      (this.getDataValue(a, column).value.toLowerCase() < this.getDataValue(b, column).value.toLowerCase() ? -1 : 1) *
      (isAsc ? 1 : -1)
    );
  }

  getFilteredScenarioEvents(scenarioEvents: ScenarioEventPlus[]): ScenarioEventPlus[] {
    let filteredScenarioEvents: ScenarioEventPlus[] = [];
    if (scenarioEvents) {
      scenarioEvents.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredScenarioEvents.push({... se});
        }
      });
      if (filteredScenarioEvents && filteredScenarioEvents.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredScenarioEvents = filteredScenarioEvents
          .filter((a) =>
            this.allDataFields.forEach(function (df) {
              this.getDataValue(a, df.name).value.toLowerCase().includes(filterString);
            }));
      }
    }
    return filteredScenarioEvents;
  }

  addScenarioEvent() {
    const newScenarioEvent = this.createBlankScenarioEvent();
    this.isAddingScenarioEvent = true;
    this.displayEditDialog(newScenarioEvent);
  }

  editScenarioEvent(scenarioEvent: ScenarioEvent) {
    const editScenarioEvent = {... scenarioEvent};
    editScenarioEvent.dataValues = [];
    this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .forEach(dv => {
        editScenarioEvent.dataValues.push({ ...dv });
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
      data: {
        scenarioEvent: scenarioEvent,
        dataFields: this.allDataFields,
        organizationList: this.getSortedOrganizationOptions(),
        teamList: this.teamList,
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
        userList: this.mselUsers
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
      status: ItemStatus.Pending,
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
    this.getDataValue(scenarioEvent, dataFieldName).value = newValue;
    this.dataValueDataService.updateDataValue(this.getDataValue(scenarioEvent, dataFieldName));
  }

  saveDataValueArray(scenarioEvent: ScenarioEventPlus, dataFieldName: string, newValues: string[]) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    this.getDataValue(scenarioEvent, dataFieldName).value = newValues.join(', ');
    this.getDataValue(scenarioEvent, dataFieldName).valueArray = newValues;
    this.dataValueDataService.updateDataValue(this.getDataValue(scenarioEvent, dataFieldName));
  }

  saveScenarioEvent(scenarioEvent: ScenarioEvent) {
    if (this.isAddingScenarioEvent) {
      this.scenarioEventDataService.add(scenarioEvent);
    } else {
      this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
    }
  }

  deleteScenarioEvent(scenarioEvent: ScenarioEvent): void {
    this.dialogService
      .confirm(
        'Delete ScenarioEvent',
        'Are you sure that you want to delete ' + 'scenarioEvent' + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.scenarioEventDataService.delete(scenarioEvent.id);
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

  selectNewColor(color: string, scenarioEvent: ScenarioEventPlus) {
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

  getStyle(dataField: DataField): string {
    if (dataField && dataField.columnMetadata) {
      const width = Math.trunc(+dataField.columnMetadata * 7);  // 7 converts excel widths to http widths
      return 'width: ' + width.toString() + 'px;';
    } else if (dataField.dataType.toString() === 'DateTime') {
      return 'width: max-content';
    } else {
      return 'width: ' + Math.trunc( 100 / this.sortedDataFields.length) + 'vh;';
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
    const formattedValue = dateValue ? new Date(dateValue).toLocaleString() : ' ';
    return formattedValue;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
