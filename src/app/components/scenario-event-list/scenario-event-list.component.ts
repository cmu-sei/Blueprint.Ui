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
  ItemStatus,
  DataField,
  DataFieldType,
  DataValue,
  ScenarioEvent,
  MselRole
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { Sort } from '@angular/material/sort';
import { MatMenuTrigger } from '@angular/material/menu';
import { ScenarioEventDataService } from 'src/app/data/scenario-event/scenario-event-data.service';
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
  msel = new MselPlus();
  mselScenarioEvents: ScenarioEvent[] = [];
  expandedScenarioEventIds: string[] = [];
  expandedMoreScenarioEventIds: string[] = [];
  filteredScenarioEventList: ScenarioEvent[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedScenarioEvents: ScenarioEvent[] = [];
  private lessDataFieldNames: string[] = ['details'];
  lessDataFields: DataField[];
  moreDataFields: DataField[];
  dataValueList = new Map<string, Map<string, string>>();
  editingValueList = new Map<string, string>();
  newScenarioEvent: ScenarioEvent;
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
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private moveDataService: MoveDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    private dataValueDataService: DataValueDataService,
    public dialogService: DialogService
  ) {
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        Object.assign(this.msel, msel);
        this.scenarioEventDataService.loadByMsel(msel.id);
      }
    });
    this.scenarioEventQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(scenarioEvents => {
      this.mselScenarioEvents = scenarioEvents;
      this.sortedScenarioEvents = this.getSortedScenarioEvents(this.getFilteredScenarioEvents(this.mselScenarioEvents));
      this.getSortedDataFields(this.msel.dataFields);
      this.populateDataValueList();
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
      this.sortedScenarioEvents = this.getSortedScenarioEvents(this.getFilteredScenarioEvents(this.mselScenarioEvents));
    });
    // is user a contentdeveloper or system admin?
    this.userDataService.isContentDeveloper.pipe(takeUntil(this.unsubscribe$)).subscribe((isOne) => {
      this.canDoAnything = isOne;
    });
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    const sortedScenarioEvents: ScenarioEvent[] = [];
    if (scenarioEvents) {
      scenarioEvents.forEach(se => {
        sortedScenarioEvents.push({... se});
      });

      if (sortedScenarioEvents && sortedScenarioEvents.length > 0 && this.sort && this.sort.direction) {
        this.filteredScenarioEventList = sortedScenarioEvents
          .sort((a: ScenarioEvent, b: ScenarioEvent) => this.sortScenarioEvents(a, b, this.sort.active, this.sort.direction));
      } else {
        sortedScenarioEvents.sort((a, b) => +a.rowIndex > +b.rowIndex ? 1 : -1);
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
          lessDataFields.push({... df});
        } else {
          moreDataFields.push({... df});
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

  populateDataValueList() {
    this.mselScenarioEvents.forEach(se => {
      const seDataValues = new Map<string, string>();
      seDataValues[se.id + 'ri'] = se.rowIndex;
      seDataValues[se.id + 'rm'] = se.rowMetadata;
      se.dataValues.forEach(dv => {
        seDataValues[dv.dataFieldId] = dv.value;
      });
      this.dataValueList[se.id] = seDataValues;
     });
  }

  trackByFn(index, item) {
    return item.id;
  }

  selectScenarioEvent(id: string) {
    const expandedIndex = this.expandedScenarioEventIds.findIndex(seId => seId === id);
    if (expandedIndex === -1) {
      this.expandedScenarioEventIds.push(id);
    } else {
      this.expandedScenarioEventIds.splice(expandedIndex, 1);
    }
  }

  isExpandedScenarioEvent(id: string) {
    return this.expandedScenarioEventIds.findIndex(seId => seId === id) > -1;
  }

  selectMoreScenarioEvent(id: string) {
    const expandedIndex = this.expandedMoreScenarioEventIds.findIndex(seId => seId === id);
    if (expandedIndex === -1) {
      this.expandedMoreScenarioEventIds.push(id);
    } else {
      this.expandedMoreScenarioEventIds.splice(expandedIndex, 1);
    }
  }

  isExpandedMoreScenarioEvent(id: string) {
    return this.expandedMoreScenarioEventIds.findIndex(seId => seId === id) > -1;
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) return '';
    const dataField = this.msel.dataFields.find(df => df.name.toLowerCase().replace(/ /gi,'') === columnName.toLowerCase().replace(/ /gi,''));
    if (!dataField) return '';
    const dataValue = scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataField.id);
    return dataValue ? dataValue.value : ' ';
  }

  getDataValue(scenarioEvent: ScenarioEvent, dataFieldName: string): DataValue {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) return {};
    const dataField = this.msel.dataFields.find(df => df.name === dataFieldName);
    if (!dataField) return {};
    const dataValue = scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataField.id);
    return dataValue;
  }

  getDataFieldIdByName(scenarioEvent: ScenarioEvent, name: string): string {
    const dataField = this.moreDataFields.find(df => df.name.toLowerCase() === name.toLowerCase()) ||
                      this.lessDataFields.find(df => df.name.toLowerCase() === name.toLowerCase());
    return dataField ? dataField.id : 'no data value found';
  }

  enableEditing(scenarioEvent: ScenarioEvent) {
    this.editingValueList.set(scenarioEvent.id + 'ri', scenarioEvent.rowIndex.toString());
    this.editingValueList.set(scenarioEvent.id + 'rm', scenarioEvent.rowMetadata);
    scenarioEvent.dataValues.forEach(dv => {
      this.editingValueList.set(dv.id, dv.value);
    });
  }

  saveUpdate(scenarioEvent: ScenarioEvent) {
    const scenarioEventToUpdate = deepCopy(scenarioEvent);
    const originalDataValues = deepCopy(scenarioEvent.dataValues);
    scenarioEventToUpdate.dataValues = [];
    originalDataValues.forEach(dv => {
      const dataValue = deepCopy(dv);
      const newValue = this.dataValueList[scenarioEvent.id][dv.dataFieldId];
      if (dataValue.value !== newValue) {
        dataValue.value = newValue;
        scenarioEventToUpdate.dataValues.push(dataValue);
      }
      this.editingValueList.delete(dataValue.id);
    });
    this.scenarioEventDataService.updateScenarioEvent(scenarioEventToUpdate);
    this.editingValueList.delete(scenarioEvent.id + 'ri');
    this.editingValueList.delete(scenarioEvent.id + 'rm');
  }

  resetUpdate(scenarioEvent: ScenarioEvent) {
    this.editingValueList.delete(scenarioEvent.id + 'ri');
    this.editingValueList.delete(scenarioEvent.id + 'rm');
    scenarioEvent.dataValues.forEach(dv => {
      this.dataValueList[scenarioEvent.id][dv.dataFieldId] = dv.value;
      this.editingValueList.delete(dv.id);
    });
  }

  saveAssignedTeam(scenarioEvent: ScenarioEvent, teamId: string) {
    const {dataValues, ...saveScenarioEvent} = scenarioEvent;
    saveScenarioEvent.assignedTeamId = teamId;
    this.scenarioEventDataService.updateScenarioEvent(saveScenarioEvent);
  }

  saveStatus(scenarioEvent: ScenarioEvent, status: ItemStatus) {
    const {dataValues, ...saveScenarioEvent} = scenarioEvent;
    saveScenarioEvent.status = status;
    this.scenarioEventDataService.updateScenarioEvent(saveScenarioEvent);
  }

  getTeamShortName(teamId: string) {
    if (!teamId) return '';
    const team = this.msel.teams.find(t => t.id === teamId);
    return team ? team.shortName : '';
  }

  isDisabled(scenarioEvent: ScenarioEvent, dataFieldName: string): boolean {
    const hasTheValue = this.editingValueList.has(this.getDataValue(scenarioEvent, dataFieldName).id) ||
      this.editingValueList.has(dataFieldName);
    return !hasTheValue;
  }

  isViewOnly(scenarioEvent: ScenarioEvent): boolean {
    return !this.editingValueList.has(scenarioEvent.dataValues[0].id);
  }

  onContextMenu(event: MouseEvent, scenarioEvent: ScenarioEvent) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.menuData = { item: scenarioEvent };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedScenarioEvents = this.getSortedScenarioEvents(this.getFilteredScenarioEvents(this.mselScenarioEvents));
  }

  private sortScenarioEvents(
    a: ScenarioEvent,
    b: ScenarioEvent,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'controlnumber':
      case 'fromorg':
      case "toorg":
      case "description":
        return (
          (this.getScenarioEventValue(a, column) < this.getScenarioEventValue(b, column) ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case "assignedto":
        return (this.getTeamShortName(a.assignedTeamId).toLowerCase() < this.getTeamShortName(b.assignedTeamId).toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
      case "status":
        return (a.status < b.status ? -1 : 1) * (isAsc ? 1 : -1);
      default:
        return 0;
    }
  }

  getFilteredScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    let filteredScenarioEvents: ScenarioEvent[] = [];
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
            this.getScenarioEventValue(a, 'controlnumber').toLowerCase().includes(filterString) ||
            this.getScenarioEventValue(a, 'assignedto').toLowerCase().includes(filterString) ||
            this.getScenarioEventValue(a, 'status').toLowerCase().includes(filterString) ||
            this.getScenarioEventValue(a, 'fromorg').toLowerCase().includes(filterString) ||
            this.getScenarioEventValue(a, 'toorg').toLowerCase().includes(filterString) ||
            this.getScenarioEventValue(a, 'description').toLowerCase().includes(filterString)
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
      dataValues: []
    };
    const seDataValues = new Map<string, string>();
    seDataValues[seId + 'ri'] = '';
    seDataValues[seId + 'rm'] = '';
    this.msel.dataFields.forEach(df => {
      this.newScenarioEvent.dataValues.push({
        dataFieldId: df.id,
        id: uuidv4(),
        scenarioEventId:this.newScenarioEvent.id,
        value: ''
      });
      seDataValues[df.id] = '';
    });
    this.dataValueList[this.newScenarioEvent.id] = seDataValues;
    this.isAddingScenarioEvent = true;
  }

  copyScenarioEvent(scenarioEvent: ScenarioEvent): void {
    this.newScenarioEvent = {... scenarioEvent};
    this.newScenarioEvent.id = uuidv4();
    this.newScenarioEvent.dataValues = [];
    const seDataValues = new Map<string, string>();
    seDataValues[scenarioEvent.id + 'ri'] = scenarioEvent.rowIndex;
    seDataValues[scenarioEvent.id + 'rm'] = scenarioEvent.rowMetadata;
    scenarioEvent.dataValues.forEach(dv => {
      this.newScenarioEvent.dataValues.push({
        id: uuidv4(),
        dataFieldId: dv.dataFieldId,
        scenarioEventId:this.newScenarioEvent.id,
        value: dv.value
      });
      seDataValues[dv.dataFieldId] = dv.value;
    });
    this.dataValueList[this.newScenarioEvent.id] = seDataValues;
    this.isAddingScenarioEvent = true;
  }

  saveNewScenarioEvent() {
    this.isAddingScenarioEvent = false;
    this.newScenarioEvent.dataValues.forEach(dv => {
      dv.value = this.dataValueList[this.newScenarioEvent.id][dv.dataFieldId];
    });
    this.scenarioEventDataService.add(this.newScenarioEvent);
  }

  cancelNewScenarioEvent() {
    this.isAddingScenarioEvent = false;
  }

  deleteScenarioEvent(scenarioEvent: ScenarioEvent): void {
  this.dialogService
    .confirm(
      'Delete ScenarioEvent',
      'Are you sure that you want to delete ' + this.getScenarioEventValue(scenarioEvent, 'description') + '?'
    )
    .subscribe((result) => {
      if (result['confirm']) {
        this.scenarioEventDataService.delete(scenarioEvent.id);
      }
    });
  }

  notValidDateFormat(dateString: string) {
    // only check if there is a value
    if (dateString.length === 0) {
      return false;
    }
    // check for month/day/year format
    const regexPattern: RegExp = /^(0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d$/;
    return !regexPattern.test(dateString);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
