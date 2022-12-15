// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
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
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-scenario-event-edit-dialog',
  templateUrl: './scenario-event-edit-dialog.component.html',
  styleUrls: ['./scenario-event-edit-dialog.component.scss'],
})
export class ScenarioEventEditDialogComponent implements OnDestroy, OnInit {
  // @Input() scenarioEvent: ScenarioEventPlus;
  // @Input() dataFields: DataField[];
  // @Input() organizationList: string[];
  // @Input() cardList: Card[];
  // @Input() gallerySourceTypes: string[];
  // @Input() canEdit: boolean;
  @Output() editComplete = new EventEmitter<any>();
  sort: Sort = {active: '', direction: ''};
  sortedScenarioEvents: ScenarioEventPlus[] = [];
  newScenarioEvent: ScenarioEventPlus;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
  editorStyle = {
    'height': '100%',
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
  scenarioEventBackgroundColors: Array<string>;
  dataFieldTypes = DataFieldType.keys;
  sortedDataFields: DataField[] = [];
  selectedTab = 0;
  tabSections = new Map([
    ['default', 0],
    ['all', 1],
    ['gallery', 2],
    ['cite', 3],
    ['steamfitter', 4]
  ]);

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<ScenarioEventEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {
    if (this.data.isNew) {
      this.sortedDataFields = this.getFilteredDataFields('all');
      this.selectedTab = this.tabSections.get('all');
    } else {
      this.sortedDataFields = this.getFilteredDataFields('default');
      this.selectedTab = this.tabSections.get('default');
    }
  }

  trackByFn(index, item) {
    return item.id;
  }

  getDataValue(dataFieldName: string): DataValuePlus {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    const dataValue = this.data.scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataFieldId);
    return dataValue ? dataValue as DataValuePlus : this.blankDataValue;
  }

  getDataFieldIdByName(name: string): string {
    const dataField = this.data.dataFields.find(df => df.name.toLowerCase() === name.toLowerCase());
    return dataField ? dataField.id : '';
  }

  isDisabled(dataFieldName: string): boolean {
    return !this.data.canEdit;
  }

  isViewOnly(): boolean {
    return !this.data.canEdit;
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

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, organization: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        scenarioEvent: this.data.scenarioEvent
      });
    }
  }

  tabChange(event) {
    const injectData = event.tab.textLabel.toLowerCase().replace(' ', '');
    this.sortedDataFields = this.getFilteredDataFields(injectData);
  }

  getFilteredDataFields(filter: string): DataField[] {
    let filteredList = [];
    switch (filter) {
      case 'default':
        filteredList = this.data.dataFields.filter(x => !x.isInitiallyHidden);
        break;
      case 'gallery':
        filteredList = this.data.dataFields.filter(x => !!x.galleryArticleParameter);
        break;
      default:
        filteredList = this.data.dataFields;
    }
    filteredList =  filteredList.sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
    return filteredList;
  }

  hasBadData(): boolean {
    return false;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
