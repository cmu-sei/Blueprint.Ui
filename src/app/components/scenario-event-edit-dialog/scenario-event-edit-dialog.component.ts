// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import {
  DataField,
  DataFieldType,
  MselItemStatus,
  MselRole,
  Team
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { ScenarioEventPlus, DataValuePlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

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
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      {class: 'arial', name: 'Arial'},
      {class: 'times-new-roman', name: 'Times New Roman'},
      {class: 'calibri', name: 'Calibri'},
      {class: 'comic-sans-ms', name: 'Comic Sans MS'}
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: true,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [
      ['backgroundColor']
    ]
  };
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

  itemStatus = [MselItemStatus.Pending, MselItemStatus.Entered, MselItemStatus.Approved, MselItemStatus.Complete, MselItemStatus.Deployed, MselItemStatus.Archived];
  mselRole = { Owner: MselRole.Owner, Approver: MselRole.Approver, Editor: MselRole.Editor};
  toOrgList: string[] = [];
  sortedMselTeams: Team[] = [];
  blankDataValue = {
    id: '',
    value: '',
    valueArray: []
  } as DataValuePlus;
  scenarioEventBackgroundColors: Array<string>;
  sortedDataFields: DataField[] = [];
  selectedTab = 0;
  private tabSections = new Map([
    ['default', 0],
    ['advanced', 1]
  ]);
  private tabCount = 2;
  currentFilterBy = 'default';

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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
