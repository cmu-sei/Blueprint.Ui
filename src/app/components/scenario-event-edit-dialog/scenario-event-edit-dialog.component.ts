// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
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
import { UntypedFormControl } from '@angular/forms';

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
    ['advanced', 1]
  ]);
  private tabCount = 2;
  currentFilterBy = 'default';
  eventStartTimeFormControl = new UntypedFormControl(
    this.getDateFromDeltaSeconds(this.data.scenarioEvent.deltaSeconds),
    []
  );
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<ScenarioEventEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {
    if (this.data.isNew) {
      this.sortedDataFields = this.getFilteredDataFields('advanced');
      this.selectedTab = this.tabSections.get('advanced');
    } else {
      this.sortedDataFields = this.getFilteredDataFields('default');
      this.selectedTab = this.tabSections.get('default');
    }
    if (this.data.useGallery) {
      this.tabSections.set('advanced', this.tabCount++);
      this.tabSections.set('gallery', this.tabCount);
    }
    this.setDeltaValues();
  }

  trackByFn(index, item) {
    return item.id;
  }

  getDataOptions(dataFieldId: string) {
    return this.data.dataOptions.filter(x => x.dataFieldId === dataFieldId);
  }

  getDataValue(dataFieldName: string): DataValuePlus {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    const dataValue = this.data.scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataFieldId);
    return dataValue ? dataValue as DataValuePlus : this.blankDataValue;
  }

  setDataValue(dataFieldName: string, value: string) {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (dataFieldId) {
      const dataValue = this.data.scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataFieldId);
      dataValue.value = value;
    }
  }

  setDataValueArray(dataFieldName: string, newValues: string[]) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    this.getDataValue(dataFieldName).valueArray = newValues;
    this.getDataValue(dataFieldName).value = newValues.join(', ');
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
    this.currentFilterBy = filter;
    let filteredList = [];
    switch (filter) {
      case 'default':
        filteredList = this.data.dataFields.filter(x => !x.isInitiallyHidden);
        break;
      case 'gallery':
        filteredList = this.data.dataFields.filter(x => !!x.galleryArticleParameter);
        break;
      case 'advanced':
        filteredList = this.data.dataFields.filter(x => x.isInitiallyHidden && !x.galleryArticleParameter);
        break;
    }
    filteredList =  filteredList.sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
    return filteredList;
  }

  hasBadData(): boolean {
    return false;
  }

  getDateFromDeltaSeconds(deltaSeconds: number): Date {
    const mselStartTime = new Date(this.data.mselStartTime);
    return new Date(mselStartTime.getTime() + (deltaSeconds * 1000));
  }

  getDeltaSecondsFromDate() {
    const scenarioEventValue = this.eventStartTimeFormControl.value;
    const scenarioEventSeconds = scenarioEventValue.getTime() / 1000;
    const startValue = new Date(this.data.mselStartTime);
    const startSeconds = startValue.getTime() / 1000;
    return scenarioEventSeconds - startSeconds;
  }

  setDeltaValues() {
    let deltaSeconds = this.getDeltaSecondsFromDate();
    this.data.scenarioEvent.deltaSeconds = deltaSeconds;
    // get the number of days
    this.days = Math.floor(deltaSeconds / 86400);
    deltaSeconds = deltaSeconds % 86400;
    // get the number of hours
    this.hours = Math.floor(deltaSeconds / 3600);
    deltaSeconds = deltaSeconds % 3600;
    // get the number of minutes
    this.minutes = Math.floor(deltaSeconds / 60);
    deltaSeconds = deltaSeconds % 60;
    // get the number of seconds
    this.seconds = +deltaSeconds;
  }

  calculateDeltaSeconds() {
    return this.days * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds;
  }

  deltaUpdated(event: any, whichValue: string) {
    let setValue = +event.target.value;
    switch (whichValue) {
      case 'd':
        setValue = setValue < 0 ? 0 : setValue;
        this.days = setValue;
        break;
      case 'h':
        setValue = setValue < 0 ? 0 : setValue > 23 ? 23 : setValue;
        this.hours = setValue;
        break;
      case 'm':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.minutes = setValue;
        break;
      case 's':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.seconds = setValue;
        break;
    }
    this.data.scenarioEvent.deltaSeconds = this.calculateDeltaSeconds();
    this.eventStartTimeFormControl.setValue(this.getDateFromDeltaSeconds(this.data.scenarioEvent.deltaSeconds));
  }

  timeUpdated() {
    this.data.scenarioEvent.deltaSeconds = this.getDeltaSecondsFromDate();
    this.setDeltaValues();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
