// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
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
import { DataFieldEditDialogComponent } from '../data-field-edit-dialog/data-field-edit-dialog.component';
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
export class DataFieldListComponent implements OnDestroy {
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
    });
    // subscribe to the active MSEL changes to get future changes
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(m => {
      if (m && this.msel.id !== m.id) {
        Object.assign(this.msel, m);
        this.sortedDataFields = this.getSortedDataFields(this.getFilteredDataFields(this.dataFieldList));
      }
    });
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortedDataFields = this.getSortedDataFields(this.getFilteredDataFields(this.dataFieldList));
      });
  }

  getSortedDataFields(dataFields: DataField[]) {
    if (dataFields) {
      dataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return dataFields;
  }

  addOrEditDataField(dataField: DataField) {
    if (!dataField) {
      dataField = {
        mselId: this.msel.id,
        displayOrder: this.dataFieldList.length + 1,
        isInitiallyHidden: true,
        onScenarioEventList: true,
        onExerciseView: true
      } as DataField;
    }
    const dialogRef = this.dialog.open(DataFieldEditDialogComponent, {
      width: '90%',
      maxWidth: '900px',
      data: {
        dataField: dataField,
        isContentDeveloper: this.isContentDeveloper,
        isOwner: this.msel.hasRole(this.loggedInUserId, null).owner,
        dataFieldOptions: this.dataOptionList.filter(x => x.dataFieldId === dataField.id),
        galleryArticleParameters: this.msel.galleryArticleParameters,
        useGallery: this.msel.useGallery,
        useCite: this.msel.useCite,
        dataFieldTypes: this.dataFieldTypes
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.dataField) {
        const dataFieldId = this.saveDataField(result.dataField);
        result.addedDataFieldOptions.forEach(dfo => {
          dfo.dataFieldId = dataFieldId;
          console.log('add ' + dfo.optionName);
          this.dataOptionDataService.add(dfo);
        });
        result.changedDataFieldOptions.forEach(dfo => {
          console.log('update ' + dfo.optionName);
          this.dataOptionDataService.updateDataOption(dfo);
        });
        result.deletedDataFieldOptions.forEach(dfo => {
          console.log('delete ' + dfo.optionName);
          this.dataOptionDataService.delete(dfo.id);
        });
      }
      dialogRef.close();
    });
  }

  saveDataField(dataField: DataField): string {
    if (dataField.id) {
      this.dataFieldDataService.updateDataField(dataField);
    } else {
      dataField.id = uuidv4();
      this.dataFieldDataService.add(dataField);
    }
    return dataField.id;
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

  getDataOptionsString(dataFieldId: string): string {
    const dataOptions = this.getDataFieldOptions(dataFieldId).map(function(elem){
      return elem.optionName;
    });
    return dataOptions.join(', ');
  }

  saveChange(dataField: DataField) {
    this.dataFieldDataService.updateDataField(dataField);
  }

  galleryToDo(): string {
    let todoString = '';
    let todoList = Object.assign([], this.msel.galleryArticleParameters);
    if (todoList && todoList.length > 0) {
      todoList = todoList.filter(x => !this.dataFieldList.some(df => df.galleryArticleParameter === x));
      todoString = todoList.join(', ');
    }
    return todoString;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
