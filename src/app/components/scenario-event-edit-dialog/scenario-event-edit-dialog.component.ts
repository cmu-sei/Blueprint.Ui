// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import {
  DataField,
  DataFieldType,
  ItemStatus,
  MselRole,
  Team
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { ScenarioEventPlus, DataValuePlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-scenario-event-edit-dialog',
  templateUrl: './scenario-event-edit-dialog.component.html',
  styleUrls: ['./scenario-event-edit-dialog.component.scss'],
})
export class ScenarioEventEditDialogComponent implements OnDestroy, OnInit {
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
  public scenarioEventTimeFormControls = new UntypedFormControl(
    this.data.scenarioEvent.dateString,
    []
  );

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
  private tabSections = new Map([
    ['default', 0],
    ['all', 1]
  ]);
  private tabCount = 2;

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
    if (this.data.useCite) {
      this.tabSections.set('cite', this.tabCount++);
    }
    if (this.data.useGallery) {
      this.tabSections.set('gallery', this.tabCount++);
    }
    if (this.data.useSteamfitter) {
      this.tabSections.set('steamfitter', this.tabCount++);
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
