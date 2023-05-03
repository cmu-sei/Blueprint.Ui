// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DataField,
  DataFieldType,
  DataOption
} from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataOptionDataService } from 'src/app/data/data-option/data-option-data.service';
import { DataOptionEditDialogComponent } from '../data-option-edit-dialog/data-option-edit-dialog.component';
import { DataOptionQuery } from 'src/app/data/data-option/data-option.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-data-field-list',
  templateUrl: './data-field-list.component.html',
  styleUrls: ['./data-field-list.component.scss'],
})
export class DataFieldListComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  msel = new MselPlus();
  dataFieldList: DataField[] = [];
  changedDataField: DataField = {};
  filteredDataFieldList: DataField[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: '', direction: ''};
  sortedDataFields: DataField[] = [];
  isAddingDataField = false;
  editingId = '';
  dataOptionList: DataOption[] = [];
  dataFieldTypes = DataFieldType.keys;

  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private dataOptionDataService: DataOptionDataService,
    private dataOptionQuery: DataOptionQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to data options
    this.dataOptionQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataOptions => {
      this.dataOptionList = dataOptions;
    });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataFields => {
      this.dataFieldList = dataFields;
      this.sortedDataFields = this.getSortedDataFields(this.getFilteredDataFields(this.dataFieldList));
      dataFields.forEach(df => {
        if (df.isChosenFromList) {
          this.dataOptionDataService.loadByDataField(df.id);
        }
      });
    });
    // we have to check for the current active msel AND for any future changes
    // set the MSEL values and get the needed info, if there is a current one
    const msel = this.mselQuery.getActive() as MselPlus;
    if (msel && (!this.msel || this.msel.id !== msel.id)) {
      Object.assign(this.msel, msel);
      this.dataFieldDataService.loadByMsel(msel.id);
    }
    // subscribe to the active MSEL changes to get future changes
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(m => {
      if (m && (!this.msel || this.msel.id !== m.id)) {
        Object.assign(this.msel, m);
        this.dataFieldDataService.loadByMsel(m.id);
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedDataFields = this.getSortedDataFields(this.getFilteredDataFields(this.dataFieldList));
      });
  }

  ngOnInit() {
  }

  getSortedDataFields(dataFields: DataField[]) {
    if (dataFields) {
      dataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return dataFields;
  }

  noExpansionChangeAllowed() {
    return this.isAddingDataField || this.valuesHaveBeenChanged();
  }

  editDataField(dataField: DataField) {
    if (this.isAddingDataField) {
      return;
    }
    // previous edit has not been saved, so prompt
    if (this.valuesHaveBeenChanged()) {
      this.dialogService
        .confirm(
          'Changes have been made!',
          'Do you want to save them?'
        )
        .subscribe((result) => {
          if (result['confirm']) {
            this.dataFieldDataService.updateDataField(this.changedDataField);
          }
          this.setEditing(dataField);
        });
    } else {
      this.setEditing(dataField);
    }
  }

  setEditing(dataField) {
    if (dataField.id === this.editingId) {
      this.editingId = '';
      this.changedDataField = {};
    } else {
      this.editingId = dataField.id;
      this.changedDataField = {... dataField};
      this.changedDataField.dataOptions = [];
      dataField.dataOptions.forEach(datOp => {
        this.changedDataField.dataOptions.push(datOp);
      });
    }
  }

  valuesHaveBeenChanged() {
    let isChanged = false;
    const original = this.dataFieldList.find(df => df.id === this.editingId);
    if (original) {
      isChanged = this.changedDataField.dataType !== original.dataType ||
                  this.changedDataField.displayOrder !== original.displayOrder ||
                  this.changedDataField.isChosenFromList !== original.isChosenFromList ||
                  this.changedDataField.isInitiallyHidden !== original.isInitiallyHidden ||
                  this.changedDataField.isOnlyShownToOwners !== original.isOnlyShownToOwners ||
                  this.changedDataField.galleryArticleParameter !== original.galleryArticleParameter ||
                  this.changedDataField.name !== original.name ||
                  this.changedDataField.cellMetadata !== original.cellMetadata ||
                  this.changedDataField.columnMetadata !== original.columnMetadata;
    }
    return isChanged;
  }

  saveChange(dataField: DataField) {
    this.dataFieldDataService.updateDataField(dataField);
  }

  saveDataField() {
    this.dataFieldDataService.updateDataField(this.changedDataField);
    this.editingId = '';
  }

  resetDataField() {
    this.changedDataField = {};
    this.editingId = '';
  }

  addDataField() {
    this.changedDataField = {
      id: uuidv4(),
      mselId: this.msel.id,
      dataType: DataFieldType.String,
      isChosenFromList: false,
      dataOptions: []
    };
    this.isAddingDataField = true;
  }

  saveNewDataField() {
    this.isAddingDataField = false;
    this.dataFieldDataService.add(this.changedDataField);
  }

  cancelNewDataField() {
    this.isAddingDataField = false;
  }

  deleteDataField(dataField: DataField): void {
    if (this.isAddingDataField || (this.editingId && this.editingId !== dataField.id)) {
      return;
    }
    this.dialogService
      .confirm(
        'Delete DataField',
        'Are you sure that you want to delete ' + dataField.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.dataFieldDataService.delete(dataField.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.sortedDataFields = this.getSortedDataFields(this.getFilteredDataFields(this.dataFieldList));
  }

  private sortDataFields(
    a: DataField,
    b: DataField,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'displayOrder':
        return ( (a.displayOrder < b.displayOrder ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'name':
        return ( (a.name < b.name ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'isChosenFromList':
        return ( (a.isChosenFromList < b.isChosenFromList ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  getFilteredDataFields(dataFields: DataField[]): DataField[] {
    let filteredDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(se => {
        if (se.mselId === this.msel.id) {
          filteredDataFields.push({... se});
        }
      });
      if (filteredDataFields && filteredDataFields.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredDataFields = filteredDataFields
          .filter((a) =>
            a.name.toLowerCase().includes(filterString) ||
            a.dataType.toLowerCase().includes(filterString)
          );
      }
    }
    return filteredDataFields;
  }

  getDataFieldOptions(dataFieldId: string) {
    return this.dataOptionList
      .filter(x => x.dataFieldId === dataFieldId)
      .sort((a, b) => a.displayOrder < b.displayOrder ? -1 : 1);
  }

  addOrEditDataOption(dataOption: DataOption) {
    const dialogRef = this.dialog.open(DataOptionEditDialogComponent, {
      width: '800px',
      data: {
        dataOption: dataOption
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.dataOption) {
        this.saveDataOption(result.dataOption);
      }
      dialogRef.close();
    });
  }

  addDataOption(dataField: DataField) {
    this.addOrEditDataOption({
      displayOrder: this.getDataFieldOptions(dataField.id).length + 1,
      dataFieldId: dataField.id
    });
  }

  editDataOption(dataOption: DataOption) {
    const selected = {... dataOption};
    this.addOrEditDataOption(selected);
  }

  saveDataOption(dataOption: DataOption) {
    if (dataOption.id) {
      this.dataOptionDataService.updateDataOption(dataOption);
    } else {
      dataOption.id = uuidv4();
      this.dataOptionDataService.add(dataOption);
    }
  }

  deleteDataOption(dataOption: DataOption) {
    this.dialogService
      .confirm(
        'Delete Option',
        'Are you sure that you want to delete ' + dataOption.optionName + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.dataOptionDataService.delete(dataOption.id);
        }
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
