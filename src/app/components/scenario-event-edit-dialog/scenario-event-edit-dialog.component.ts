// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import {
  DataField,
  DataFieldType,
  EventType,
  MselItemStatus,
  MselRole,
  ScenarioEvent,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { DataValuePlus, IntegrationTarget } from 'src/app/data/scenario-event/scenario-event-data.service';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import {
  DataValueDraftDialogComponent,
  DataValueDraftDialogData,
} from 'src/app/components/data-value-draft-dialog/data-value-draft-dialog.component';
import { EDITOR_CONFIG, VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { hasInvalidAddress } from 'src/app/utilities/ip-address';

@Component({
  selector: 'app-scenario-event-edit-dialog',
  templateUrl: './scenario-event-edit-dialog.component.html',
  styleUrls: ['./scenario-event-edit-dialog.component.scss'],
  standalone: false
})
export class ScenarioEventEditDialogComponent implements OnDestroy, OnInit {
  @Output() editComplete = new EventEmitter<any>();
  sort: Sort = { active: '', direction: '' };
  sortedScenarioEvents: ScenarioEvent[] = [];
  newScenarioEvent: ScenarioEvent;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
  editorConfig = EDITOR_CONFIG;
  viewConfig = VIEW_CONFIG;
  dataType: typeof DataFieldType = DataFieldType;
  eventType: typeof EventType = EventType;
  eventTypes = [
    EventType.Inject,
    EventType.Information,
    EventType.Facilitation,
  ];
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
  blankDataValue = {
    id: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  scenarioEventBackgroundColors: Array<string>;
  sortedDataFields: DataField[] = [];
  selectedTab = 0;
  selectedTabName = '';
  currentFilterBy = 'all';
  integrationTarget = IntegrationTarget;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    if (!this.data.isNew && this.showDefaultTab()) {
      this.sortedDataFields = this.getFilteredDataFields('default');
    } else {
      this.sortedDataFields = this.getFilteredDataFields('all');
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
    const dataValue = this.data.scenarioEvent.dataValues.find(
      (dv) => dv.dataFieldId === dataFieldId
    );
    return dataValue ? (dataValue as DataValuePlus) : this.blankDataValue;
  }

  setDataValue(dataFieldName: string, value: string) {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (dataFieldId) {
      const dataValue = this.data.scenarioEvent.dataValues.find(
        (dv) => dv.dataFieldId === dataFieldId
      );
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

  // Html fields only; the list-backed and typed fields have nothing to write
  canAiWrite(dataField: DataField): boolean {
    return !dataField.isChosenFromList && dataField.dataType === DataFieldType.Html;
  }

  writeWithAi(dataField: DataField) {
    const values: { [dataFieldId: string]: string } = {};
    this.data.scenarioEvent.dataValues.forEach((dv) => {
      if (dv.value) {
        values[dv.dataFieldId] = dv.value;
      }
    });
    this.dialog
      .open<DataValueDraftDialogComponent, DataValueDraftDialogData, string>(DataValueDraftDialogComponent, {
        width: '80%',
        maxWidth: '1000px',
        data: {
          mselId: this.data.scenarioEvent.mselId,
          scenarioEventId: this.data.isNew ? null : this.data.scenarioEvent.id,
          deltaSeconds: this.data.scenarioEvent.deltaSeconds ?? 0,
          dataField,
          values,
          gallerySourceTypes: this.data.gallerySourceTypes ?? [],
        },
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((value) => {
        if (value === undefined || value === null) {
          return;
        }
        const dataValue = this.data.scenarioEvent.dataValues.find((dv) => dv.dataFieldId === dataField.id);
        if (dataValue) {
          dataValue.value = value;
        } else {
          // never write into blankDataValue, which every missing field shares
          this.data.scenarioEvent.dataValues.push({ dataFieldId: dataField.id, value });
        }
      });
  }

  getDataFieldByName(name: string) {
    return this.data.dataFields.find(
      (df) => df.name.toLowerCase() === name.toLowerCase()
    );
  }

  getDataFieldIdByName(name: string): string {
    const dataField = this.getDataFieldByName(name);
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
      if (!this.data.scenarioEvent.integrationTarget?.includes('Steamfitter')) {
        this.data.scenarioEvent.steamfitterTask = null;
        this.data.scenarioEvent.steamfitterTaskId = null;
      }
      this.editComplete.emit({
        saveChanges: saveChanges,
        scenarioEvent: this.data.scenarioEvent,
      });
    }
  }

  tabChange(event) {
    const injectData = event.tab.textLabel.toLowerCase().replace(' ', '');
    this.sortedDataFields = this.getFilteredDataFields(injectData);
    this.selectedTabName = event.tab.textLabel;
  }

  scenarioEventTypeChange() {
    const filterBy = this.showDefaultTab() ? 'default' : 'all';
    this.sortedDataFields = this.getFilteredDataFields(filterBy);
  }

  // filter the data fields by the selected tab
  getFilteredDataFields(filter: string): DataField[] {
    this.currentFilterBy = filter;
    let filteredList = [];
    switch (filter) {
      case 'default':
        filteredList = this.getScenarioTypeDataFields().filter(
          (x) => x.isShownOnDefaultTab
        );
        break;
      case 'gallery':
        filteredList = (this.data.dataFields as DataField[]).filter(
          (x) => !!x.galleryArticleParameter
        );
        break;
      default:
        filteredList = (this.data.dataFields as DataField[]).slice();
        break;
    }
    filteredList = filteredList.sort((a, b) =>
      +a.displayOrder < +b.displayOrder ? -1 : 1
    );
    return filteredList;
  }

  // get the datafields based on the selected scenario event type
  getScenarioTypeDataFields(): DataField[] {
    const dataFields = new Array<DataField>();
    this.data.dataFields.forEach((df) => {
      if (
        (this.data.scenarioEvent.scenarioEventType === EventType.Inject &&
          df.onScenarioEventList) ||
        (this.data.scenarioEvent.scenarioEventType === EventType.Information &&
          df.isInformationField) ||
        (this.data.scenarioEvent.scenarioEventType === EventType.Facilitation &&
          df.isFacilitationField)
      ) {
        dataFields.push(df);
      }
    });
    return dataFields;
  }

  hasBadData(): boolean {
    return (
      (this.data.scenarioEvent.scenarioEventType === this.eventType.Inject &&
        this.getScenarioTypeDataFields().length === 0) ||
      hasInvalidAddress(this.data.dataFields, this.data.scenarioEvent.dataValues)
    );
  }

  showDefaultTab(): boolean {
    return (
      this.data.showScenarioEventType &&
      this.data.dataFields.some((d) => d.isShownOnDefaultTab)
    );
  }

  getIntegrationTargetArray(): string[] {
    const val = this.data.scenarioEvent.integrationTarget;
    return val ? val.split(', ').filter(s => s.length > 0) : [];
  }

  onIntegrationTargetChange(newValues: string[]) {
    this.data.scenarioEvent.integrationTarget = newValues.join(', ');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
