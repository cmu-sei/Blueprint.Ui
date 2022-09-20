// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  DataField,
  DataFieldType,
  DataValue,
  ItemStatus,
  MselRole,
  Organization,
  ScenarioEvent,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { ScenarioEventDataService, ScenarioEventPlus, DataValuePlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { DataValueDataService } from  'src/app/data/data-value/data-value-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';
import { deepCopy } from "deep-copy-ts";

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
  expandedScenarioEventIds: string[] = [];
  expandedMoreScenarioEventIds: string[] = [];
  editingScenarioEventIds: string[] = [];
  filteredScenarioEventList: ScenarioEventPlus[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedScenarioEvents: ScenarioEventPlus[] = [];
  private lessDataFieldNames: string[] = ['details'];
  lessDataFields: DataField[];
  moreDataFields: DataField[];
  editingValueList = new Map<string, string>();
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
  dateFormControls = new Map<string, FormControl>();
  itemStatus: ItemStatus[] = [ItemStatus.Pending, ItemStatus.Entered, ItemStatus.Approved, ItemStatus.Complete];
  mselRole = { Owner: MselRole.Owner, Approver: MselRole.Approver, Editor: MselRole.Editor};
  organizationList: Organization[] = [];
  toOrgList: string[] = [];
  sortedMselTeams: Team[] = [];
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

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private organizationQuery: OrganizationQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    private dataValueDataService: DataValueDataService,
    public dialogService: DialogService
  ) {
    this.scenarioEventBackgroundColors = this.settingsService.settings.ScenarioEventBackgroundColors;
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        this.msel = this.getEditableMsel(msel) as MselPlus;
        this.getSortedDataFields(this.msel.dataFields);
        this.scenarioEventDataService.loadByMsel(msel.id);
      }
    });
    (this.scenarioEventQuery.selectAll()).pipe(takeUntil(this.unsubscribe$)).subscribe(scenarioEvents => {
      this.mselScenarioEvents = this.getEditableScenarioEvents(scenarioEvents as ScenarioEventPlus[]);
      this.filteredScenarioEventList = this.getFilteredScenarioEvents(this.mselScenarioEvents);
      this.sortedScenarioEvents = this.getSortedScenarioEvents(this.filteredScenarioEventList);
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
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
  }

  getEditableMsel (msel: MselPlus): MselPlus {
    let editableMsel = new MselPlus();
    Object.assign(editableMsel, msel);
    editableMsel.dataFields = editableMsel.dataFields.slice(0).sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
    editableMsel.teams = editableMsel.teams.slice(0).sort((a, b) => a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1);

    return editableMsel;
  }

  getEditableScenarioEvents(scenarioEvents: ScenarioEventPlus[]): ScenarioEventPlus[] {
    const editableList: ScenarioEventPlus[] = [];
    scenarioEvents.forEach(scenarioEvent => {
      const newScenarioEvent = { ...scenarioEvent};
      const newDataValues: DataValuePlus[] = [];
      scenarioEvent.dataValues.forEach(dataValue => {
        const newDataValue = { ...dataValue} as DataValuePlus;
        newDataValue.valueArray = newDataValue.value.split(', ');
        newDataValues.push(newDataValue);
      });
      newScenarioEvent.dataValues = newDataValues;
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
    const moreDataFields: DataField[] = [];
    const lessDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        if (this.lessDataFieldNames.some(n => n === df.name.toLowerCase())) {
          lessDataFields.push(df);
        } else {
          moreDataFields.push(df);
        }
      });
      moreDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
      lessDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    // create date form controls
    moreDataFields.forEach(df => {
      if (df.dataType === DataFieldType.DateTime) {
        this.dateFormControls[df.id] = new FormControl();
      }
    });
    this.moreDataFields = moreDataFields;
    this.lessDataFields = lessDataFields;
  }

  trackByFn(index, item) {
    return item.id;
  }

  selectScenarioEvent(id: string) {
    let expandedIndex = this.expandedScenarioEventIds.findIndex(seId => seId === id);
    if (expandedIndex === -1) {
      this.expandedScenarioEventIds.push(id);
    } else {
      this.expandedScenarioEventIds.splice(expandedIndex, 1);
      expandedIndex = this.expandedMoreScenarioEventIds.findIndex(seId => seId === id);
      if (expandedIndex > -1) {
        this.expandedMoreScenarioEventIds.splice(expandedIndex, 1);
      }
    }
  }

  selectMoreScenarioEvent(id: string) {
    const expandedIndex = this.expandedMoreScenarioEventIds.findIndex(seId => seId === id);
    if (expandedIndex === -1) {
      this.expandedMoreScenarioEventIds.push(id);
    } else {
      this.expandedMoreScenarioEventIds.splice(expandedIndex, 1);
    }
  }

  isExpandedScenarioEvent(id: string) {
    return this.expandedScenarioEventIds.findIndex(seId => seId === id) > -1;
  }

  isExpandedMoreScenarioEvent(id: string) {
    return this.expandedMoreScenarioEventIds.findIndex(seId => seId === id) > -1;
  }

  getDataValue(scenarioEvent: ScenarioEventPlus, dataFieldName: string): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) return this.blankDataValue;
    const dataFieldId = this.getDataFieldIdByName(scenarioEvent, dataFieldName);
    if (!dataFieldId) return this.blankDataValue;
    const dataValue = scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataFieldId);
    return dataValue ? dataValue as DataValuePlus : this.blankDataValue;
  }

  getDataFieldIdByName(scenarioEvent: ScenarioEventPlus, name: string): string {
    const dataField = this.moreDataFields.find(df => df.name.toLowerCase() === name.toLowerCase()) ||
                      this.lessDataFields.find(df => df.name.toLowerCase() === name.toLowerCase());
    return dataField ? dataField.id : '';
  }

  enableEditing(scenarioEvent: ScenarioEventPlus) {
    this.editingValueList.set(scenarioEvent.id + 'ri', scenarioEvent.rowIndex.toString());
    this.editingValueList.set(scenarioEvent.id + 'rm', scenarioEvent.rowMetadata);
    scenarioEvent.dataValues.forEach(dv => {
      this.editingValueList.set(dv.id, dv.value);
    });
  }

  resetEditing(scenarioEvent: ScenarioEventPlus) {
    this.editingValueList.delete(scenarioEvent.id + 'ri');
    this.editingValueList.delete(scenarioEvent.id + 'rm');
    scenarioEvent.dataValues.forEach(dv => {
      this.editingValueList.delete(dv.id);
    });
  }

  isDisabled(scenarioEvent: ScenarioEventPlus, dataFieldName: string): boolean {
    const hasTheValue = this.editingValueList.has(this.getDataValue(scenarioEvent, dataFieldName).id) ||
      this.editingValueList.has(dataFieldName);
    return !hasTheValue;
  }

  isViewOnly(scenarioEvent: ScenarioEventPlus): boolean {
    return !this.editingValueList.has(scenarioEvent.dataValues[0].id);
  }

  saveUpdate(scenarioEvent: ScenarioEventPlus) {
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
    this.resetEditing(scenarioEvent);
  }

  resetUpdate(scenarioEvent: ScenarioEventPlus) {
    this.resetEditing(scenarioEvent);
  }

  saveAssignedTeam(scenarioEvent: ScenarioEventPlus, teamId: string) {
    const {dataValues, ...saveScenarioEvent} = scenarioEvent;
    saveScenarioEvent.assignedTeamId = teamId;
    this.scenarioEventDataService.updateScenarioEvent(saveScenarioEvent);
  }

  saveStatus(scenarioEvent: ScenarioEventPlus, status: ItemStatus) {
    const {dataValues, ...saveScenarioEvent} = scenarioEvent;
    saveScenarioEvent.status = status;
    this.scenarioEventDataService.updateScenarioEvent(saveScenarioEvent);
  }

  saveScenarioEvent(scenarioEvent: ScenarioEventPlus, dataFieldName: string, newValue: string) {
    this.getDataValue(scenarioEvent, dataFieldName).value = newValue;
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  saveScenarioEventArray(scenarioEvent: ScenarioEventPlus, dataFieldName: string, newValues: string[]) {
    this.getDataValue(scenarioEvent, dataFieldName).value = newValues.join(', ');
    this.getDataValue(scenarioEvent, dataFieldName).valueArray = newValues;
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  getTeamShortName(teamId: string) {
    if (!teamId) return '';
    const team = this.msel.teams.find(t => t.id === teamId);
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
    switch (column) {
      case 'control number':
      case 'from org':
      case "to org":
      case "description":
        return (
          (this.getDataValue(a, column).value.toLowerCase() < this.getDataValue(b, column).value.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case "assigned to":
        return (this.getTeamShortName(a.assignedTeamId).toLowerCase() < this.getTeamShortName(b.assignedTeamId).toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
      case "status":
        return (a.status < b.status ? -1 : 1) * (isAsc ? 1 : -1);
      default:
        return 0;
    }
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
        var filterString = this.filterString.toLowerCase();
        filteredScenarioEvents = filteredScenarioEvents
          .filter((a) =>
            this.getDataValue(a, 'control number').value.toLowerCase().includes(filterString) ||
            this.getDataValue(a, 'assigned to').value.toLowerCase().includes(filterString) ||
            this.getDataValue(a, 'status').value.toLowerCase().includes(filterString) ||
            this.getDataValue(a, 'from org').value.toLowerCase().includes(filterString) ||
            this.getDataValue(a, 'to org').value.toLowerCase().includes(filterString) ||
            this.getDataValue(a, 'description').value.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredScenarioEvents;
  }

  addScenarioEvent() {
    const seId = uuidv4();
    this.newScenarioEvent = {
      id: seId,
      mselId: this.msel.id,
      status: ItemStatus.Pending,
      dataValues: [],
      plusDataValues: []
    };
    this.msel.dataFields.forEach(df => {
      this.newScenarioEvent.dataValues.push({
        dataFieldId: df.id,
        id: uuidv4(),
        scenarioEventId:this.newScenarioEvent.id,
        value: ''
      });
    });
    this.isAddingScenarioEvent = true;
  }

  copyScenarioEvent(scenarioEvent: ScenarioEventPlus): void {
    this.newScenarioEvent = {... scenarioEvent};
    this.newScenarioEvent.id = uuidv4();
    this.newScenarioEvent.dataValues = [];
    scenarioEvent.dataValues.forEach(dv => {
      this.newScenarioEvent.dataValues.push({
        id: uuidv4(),
        dataFieldId: dv.dataFieldId,
        scenarioEventId:this.newScenarioEvent.id,
        value: dv.value
      });
    });
    this.isAddingScenarioEvent = true;
  }

  saveNewScenarioEvent() {
    this.isAddingScenarioEvent = false;
    this.scenarioEventDataService.add(this.newScenarioEvent);
  }

  cancelNewScenarioEvent() {
    this.isAddingScenarioEvent = false;
  }

  deleteScenarioEvent(scenarioEvent: ScenarioEventPlus): void {
  this.dialogService
    .confirm(
      'Delete ScenarioEvent',
      'Are you sure that you want to delete ' + this.getDataValue(scenarioEvent, 'description').value + '?'
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
    const regexPattern: RegExp = /^(0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d$/;
    return !regexPattern.test(dateString);
  }

  verifyNumber(newValue: DataValuePlus) {
    if (!newValue || !newValue.value) return;
    // remove non numeric characters, but allow "." and "-"
    newValue.value = newValue.value.replace(/[^\d.-]/g, '');
  }

  getRgbValues(rowMetadata: string) {
    const parts = rowMetadata.split(',');
    const rgbValues = parts.length >= 4 ? parts[1] + ', ' + parts[2] + ', ' + parts[3] : '';
    return rgbValues;
  }

  getStyleFromColor(color: string) {
    const tint = this.userTheme === 'dark-theme' ? this.darkThemeTint : this .lightThemeTint;
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
    // update the data values cell metadata
    scenarioEvent.dataValues.forEach(dv => {
      parts = dv.cellMetadata ? dv.cellMetadata.split(',') : ['', '', 'normal', '0'];
      const colorParts = color.split(',');
      // convert decimal value to hex
      for (let i = 0; i < colorParts.length; i++) {
        colorParts[i] = (+colorParts[i]).toString(16).trim();
        colorParts[i] = colorParts[i].length < 2 ? '0' + colorParts[i] : colorParts[i];
      }
      parts[0] = colorParts.join('');
      parts[1] = this.darkThemeTint;
      dv.cellMetadata = parts.join(',');
    });
    this.scenarioEventDataService.updateScenarioEvent(scenarioEvent);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
