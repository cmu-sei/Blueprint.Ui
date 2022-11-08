// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  DataFieldType,
  Card,
  ItemStatus,
  MselRole,
  Organization,
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
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-scenario-event-detail',
  templateUrl: './scenario-event-detail.component.html',
  styleUrls: ['./scenario-event-detail.component.scss'],
})
export class ScenarioEventDetailComponent implements OnDestroy {
  @Input() scenarioEvent: ScenarioEventPlus;
  @Input() dataFields: DataField[];
  @Input() organizationList: string[];
  @Input() cardList: Card[];
  @Input() canEdit: boolean;
  @Output() saveScenarioEvent = new EventEmitter<any>();
  sort: Sort = {active: '', direction: ''};
  sortedScenarioEvents: ScenarioEventPlus[] = [];
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
  dataFieldTypes = DataFieldType.keys;

  constructor(
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private scenarioEventDataService: ScenarioEventDataService,
    public dialogService: DialogService
  ) {
    // is user a contentdeveloper or system admin?
    this.userDataService.isContentDeveloper.pipe(takeUntil(this.unsubscribe$)).subscribe((isOne) => {
      this.canDoAnything = isOne;
    });
  }

  trackByFn(index, item) {
    return item.id;
  }

  getDataValue(dataFieldName: string): DataValuePlus {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    const dataValue = this.scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataFieldId);
    return dataValue ? dataValue as DataValuePlus : this.blankDataValue;
  }

  getDataFieldIdByName(name: string): string {
    const dataField = this.dataFields.find(df => df.name.toLowerCase() === name.toLowerCase());
    return dataField ? dataField.id : '';
  }

  enableEditing() {
    this.editingValueList.set('ri', this.scenarioEvent.rowIndex.toString());
    this.editingValueList.set('rm', this.scenarioEvent.rowMetadata);
    this.scenarioEvent.dataValues.forEach(dv => {
      this.editingValueList.set(dv.id, dv.value);
    });
  }

  resetEditing() {
    this.editingValueList.delete(this.scenarioEvent.id + 'ri');
    this.editingValueList.delete(this.scenarioEvent.id + 'rm');
    this.scenarioEvent.dataValues.forEach(dv => {
      this.editingValueList.delete(dv.id);
    });
  }

  isDisabled(dataFieldName: string): boolean {
    const hasTheValue = this.editingValueList.has(this.getDataValue(dataFieldName).id) ||
      this.editingValueList.has(dataFieldName);
    return !hasTheValue;
  }

  isViewOnly(): boolean {
    return !this.editingValueList.has(this.scenarioEvent.dataValues[0].id);
  }

  saveUpdate() {
    this.scenarioEventDataService.updateScenarioEvent(this.scenarioEvent);
    this.resetEditing();
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

  saveChange(dataFieldName: string, newValue: string) {
    this.getDataValue(dataFieldName).value = newValue;
    this.saveScenarioEvent.emit();
  }

  saveChangeArray(dataFieldName: string, newValues: string[]) {
    this.getDataValue(dataFieldName).value = newValues.join(', ');
    this.getDataValue(dataFieldName).valueArray = newValues;
    this.saveScenarioEvent.emit();
  }

  onContextMenu(event: MouseEvent, scenarioEvent: ScenarioEventPlus) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.menuData = { item: scenarioEvent };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();
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
    if (!newValue || !newValue.value) {
      return;
    }
    // remove non numeric characters, but allow '.' and '-'
    newValue.value = newValue.value.replace(/[^\d.-]/g, '');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
