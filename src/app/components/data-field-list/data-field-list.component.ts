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
  InjectType,
} from 'src/app/generated/blueprint.api';
import { Theme } from '@cmusei/crucible-common';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataFieldTemplateQuery } from 'src/app/data/data-field/data-field-template.query';
import { DataFieldEditDialogComponent } from '../data-field-edit-dialog/data-field-edit-dialog.component';
import { InjectTypeDataService } from 'src/app/data/inject-type/inject-type-data.service';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
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
  @Input() showTemplates: boolean;
  @Input() userTheme: Theme;
  @Input() injectTypeId: string;
  msel = new MselPlus();
  allDataFields: DataField[] = [];
  dataFieldList: DataField[] = [];
  templateList: DataField[] = [];
  changedDataField: DataField = {};
  filteredDataFieldList: DataField[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  allowDragAndDrop = true;
  dataFieldTypes = DataFieldType;
  systemDefinedDataFields = new Array<DataField>();
  dataFieldDataSource = new MatTableDataSource<DataField>(
    new Array<DataField>()
  );
  templateDataSource = new MatTableDataSource<DataField>(
    new Array<DataField>()
  );
  systemFieldDisplayedColumns: string[] = [
    'draghandleSpacer',
    'action',
    'events',
    'exercise',
    'name',
    'datatype',
    'options',
  ];
  displayedColumns: string[] = [
    'draghandle',
    'action',
    'events',
    'exercise',
    'name',
    'datatype',
    'options',
  ];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private mselQuery: MselQuery,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private dataFieldTemplateQuery: DataFieldTemplateQuery,
    private injectTypeDataService: InjectTypeDataService,
    private injectTypeQuery: InjectTypeQuery,
    private mselDataService: MselDataService,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    this.msel.id = null;
    // subscribe to filter string changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
    // load the dataField templates
    this.dataFieldDataService.loadTemplates();
    // subscribe to the templates
    this.dataFieldTemplateQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(
        (templates) => {
          this.templateList = templates;
          // if on the templates page, the dataFieldList is the templates
          if (this.showTemplates) {
            this.dataFieldList = templates;
          }
          this.sortChanged(this.sort);
        },
        (error) => {
          this.templateDataSource.data = [];
        }
      );
  }

  ngOnInit() {
    if (this.showTemplates) {
      this.displayedColumns.splice(2, 2);
      this.msel = new MselPlus();
      this.mselDataService.setActive('');
    } else {
      // subscribe to data fields
      this.dataFieldQuery
        .selectAll()
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe((dataFields) => {
          this.allDataFields = dataFields;
          this.setDataFieldList();
        });
      if (this.injectTypeId) {
        this.msel = new MselPlus();
        this.mselDataService.setActive('');
        this.displayedColumns.splice(1, 2);
        // load data fields for the inject type
        this.dataFieldDataService.loadByInjectType(this.injectTypeId);
      } else {
        // subscribe to the active MSEL changes to get future changes
        (this.mselQuery.selectActive() as Observable<MselPlus>)
          .pipe(takeUntil(this.unsubscribe$))
          .subscribe((m) => {
            Object.assign(this.msel, m);
            this.setDataFieldList();
            if (this.msel && this.msel.id) {
              if (
                this.msel.useGallery &&
                !this.displayedColumns.includes('integration')
              ) {
                this.displayedColumns.push('integration');
              } else if (
                !this.msel.useGallery &&
                this.displayedColumns.includes('integration')
              ) {
                this.displayedColumns.splice(this.displayedColumns.length - 1);
              }
              this.createSystemDefinedDataFields();
            }
            this.sortChanged(this.sort);
          });
      }
    }
  }

  setDataFieldList() {
    this.dataFieldList = [];
    this.allDataFields.forEach((df) => {
      if (
        (df.mselId && df.mselId === this.msel.id) ||
        (df.injectTypeId && df.injectTypeId === this.injectTypeId)
      ) {
        this.dataFieldList.push({ ...df });
      }
    });
    this.sortChanged(this.sort);
  }

  createSystemDefinedDataFields() {
    this.systemDefinedDataFields = [
      {
        displayOrder: -3,
        name: 'Move',
        onScenarioEventList: this.msel.showMoveOnScenarioEventList,
        onExerciseView: this.msel.showMoveOnExerciseView,
        galleryArticleParameter: 'Gallery Move',
        dataType: 'Move',
        description: 'System defined',
      },
      {
        displayOrder: -2,
        name: 'Group',
        onScenarioEventList: this.msel.showGroupOnScenarioEventList,
        onExerciseView: this.msel.showGroupOnExerciseView,
        galleryArticleParameter: 'Gallery Inject',
        dataType: 'Integer',
        description: 'System defined',
      },
      {
        displayOrder: -1,
        name: 'Execution Time',
        onScenarioEventList: this.msel.showTimeOnScenarioEventList,
        onExerciseView: this.msel.showTimeOnExerciseView,
        galleryArticleParameter: '- - -',
        dataType: 'DateTime',
        description: 'System defined',
      },
    ];
  }

  addOrEditDataField(dataFieldIn: DataField, makeTemplate: boolean) {
    const dataOptions =
      dataFieldIn && dataFieldIn.isChosenFromList
        ? dataFieldIn.dataOptions.slice()
        : [];
    let dataField = dataFieldIn ? { ...dataFieldIn } : null;
    if (!dataField) {
      dataField = {
        mselId: this.msel.id,
        injectTypeId: this.injectTypeId,
        displayOrder: this.dataFieldList.length + 1,
        isInitiallyHidden: true,
        onScenarioEventList: true,
        onExerciseView: true,
        isTemplate: makeTemplate,
      } as DataField;
    } else {
      dataField.id =
        makeTemplate === dataField.isTemplate ? dataField.id : null;
      if (makeTemplate) {
        dataField.mselId = null;
        dataField.injectTypeId = null;
      } else {
        dataField.mselId = this.msel.id;
        dataField.injectTypeId = this.injectTypeId;
        dataField.displayOrder = dataField.isTemplate
          ? this.dataFieldList.length + 1
          : dataField.displayOrder;
      }
      dataField.isTemplate = makeTemplate;
      dataField.onScenarioEventList = true;
      dataField.onExerciseView = true;
    }
    dataField.dataOptions = dataOptions;
    const dialogRef = this.dialog.open(DataFieldEditDialogComponent, {
      width: '90%',
      maxWidth: '900px',
      data: {
        dataField: dataField,
        isContentDeveloper: this.isContentDeveloper,
        isOwner: this.msel.hasRole(this.loggedInUserId, null).owner,
        galleryArticleParameters: this.getUnusedGalleryOptions(
          dataField.galleryArticleParameter
        ),
        useGallery: this.msel.useGallery,
        useCite: this.msel.useCite,
        dataFieldTypes: this.dataFieldTypes,
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.dataField) {
        const dataFieldId = this.saveDataField(result.dataField);
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
    this.dialogService
      .confirm(
        'Delete Data Field',
        'Are you sure that you want to delete ' + dataField.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.dataFieldDataService.delete(dataField.id);
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    if (
      (this.sort && this.sort.active && this.sort.direction) ||
      this.filterString
    ) {
      this.allowDragAndDrop = false;
    } else {
      this.allowDragAndDrop = !this.showTemplates;
    }
    this.dataFieldDataSource.data = this.getFilteredDataFields(
      this.msel.id,
      this.injectTypeId,
      this.dataFieldList
    );
    this.templateDataSource.data = this.templateList.sort((a, b) =>
      this.sortDataFields(a, b)
    );
  }

  private getNumOrDefault(value: number): number {
    if (typeof value !== undefined && typeof value !== null) {
      return +value;
    }
    return Number.NEGATIVE_INFINITY;
  }

  sortDataFieldsByDefinedSort(sort: Sort, a: DataField, b: DataField): number {
    let sortResult = 0;
    const isAsc = 'asc' === sort.direction;
    const dir = isAsc ? 1 : -1;
    const sortFieldName = sort.active;
    switch (sortFieldName) {
      case 'displayOrder':
        const numValA = this.getNumOrDefault(a.displayOrder);
        const numValB = this.getNumOrDefault(b.displayOrder);
        if (+numValA < +numValB) {
          sortResult = -1;
        } else if (+numValA > +numValB) {
          sortResult = 1;
        }
        break;
      case 'onScenarioEventList':
      case 'onExerciseView':
        const aChecked = a[sortFieldName];
        const bChecked = b[sortFieldName];
        if (aChecked !== bChecked) {
          sortResult = aChecked ? -1 : 1;
        }
        break;
      case 'name':
      case 'dataType':
        const aStr = a[sortFieldName];
        const bStr = b[sortFieldName];
        sortResult = Intl.Collator().compare(
          aStr ? aStr.trim().toLowerCase() : '',
          bStr ? bStr.trim().toLowerCase() : ''
        );
        break;
    }
    if (sortResult) {
      sortResult = sortResult * dir;
    }
    return sortResult;
  }

  sortDataFields(a: DataField, b: DataField): number {
    const defaultSort: Sort = this.showTemplates
      ? { active: 'name', direction: 'asc' }
      : { active: 'displayOrder', direction: 'asc' };
    let sortResult = 0;
    if (this.sort && this.sort.active && this.sort.direction) {
      sortResult = this.sortDataFieldsByDefinedSort(this.sort, a, b);
    }
    if (!sortResult) {
      sortResult = this.sortDataFieldsByDefinedSort(defaultSort, a, b);
    }
    return sortResult;
  }

  getFilteredDataFields(
    mselId: string,
    injectTypeId: string,
    dataFields: DataField[]
  ): DataField[] {
    let filteredDataFields: DataField[] = [];
    if (dataFields && dataFields.length > 0) {
      filteredDataFields = dataFields.slice();
      if (this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filteredDataFields = filteredDataFields.filter((a) =>
          a.name?.toLowerCase().includes(filterString)
        );
      }
    }
    if (filteredDataFields) {
      filteredDataFields.sort((a, b) => this.sortDataFields(a, b));
    }

    const returnArray =
      this.showTemplates || (!mselId && !injectTypeId)
        ? filteredDataFields
        : this.systemDefinedDataFields.concat(filteredDataFields);
    return returnArray;
  }

  getDataOptionsString(dataField: DataField): string {
    if (dataField.dataOptions) {
      const dataOptions = dataField.dataOptions
        .slice()
        .sort((a, b) => (+a.displayOrder < +b.displayOrder ? -1 : 1))
        .map(function (elem) {
          return elem.optionName;
        });
      return dataOptions.join(', ');
    } else {
      return ' ';
    }
  }

  saveChange(dataField: DataField) {
    if (dataField.displayOrder > 0) {
      this.dataFieldDataService.updateDataField(dataField);
    } else {
      switch (dataField.name) {
        case 'Move':
          this.msel.showMoveOnExerciseView = dataField.onExerciseView;
          this.msel.showMoveOnScenarioEventList = dataField.onScenarioEventList;
          break;
        case 'Group':
          this.msel.showGroupOnExerciseView = dataField.onExerciseView;
          this.msel.showGroupOnScenarioEventList =
            dataField.onScenarioEventList;
          break;
        case 'Execution Time':
          this.msel.showTimeOnExerciseView = dataField.onExerciseView;
          this.msel.showTimeOnScenarioEventList = dataField.onScenarioEventList;
          break;
      }
      this.saveMsel();
    }
  }

  galleryToDo(): string {
    let todoString = '';
    let todoList = Object.assign([], this.msel.galleryArticleParameters);
    if (todoList && todoList.length > 0) {
      todoList = todoList.filter(
        (x) =>
          !this.dataFieldList.some((df) => df.galleryArticleParameter === x)
      );
      todoString = todoList.join(', ');
    }
    return todoString;
  }

  getUnusedGalleryOptions(parameter: string): string[] {
    const options = [];
    if (this.msel.galleryArticleParameters) {
      this.msel.galleryArticleParameters.forEach((gap) => {
        if (
          parameter === gap ||
          !this.dataFieldList.some((df) => df.galleryArticleParameter === gap)
        ) {
          options.push(gap);
        }
      });
    }
    return options;
  }

  compareIntegrationValues(a: any, b: any) {
    if ((!a && !b) || a === b) {
      return true;
    } else {
      return false;
    }
  }

  fieldIsSystemDefined(index: number, rowData: DataField) {
    return rowData.displayOrder < 0;
  }

  saveMsel() {
    this.mselDataService.updateMsel(this.msel);
  }

  dropHandler(event: CdkDragDrop<string[]>) {
    // NOTE: The event index only considers rows that were draggable starting at 0
    // The nonSystemDefaultFieldStartIndex tracks which actual index is equivalent to zero
    const nonSystemDefaultFieldStartIndex =
      this.dataFieldDataSource.data.findIndex(
        (df, index) => !this.fieldIsSystemDefined(index, df)
      );
    const prevIndex = event.previousIndex + nonSystemDefaultFieldStartIndex;
    const currIndex = event.currentIndex + nonSystemDefaultFieldStartIndex;
    // sanity check
    if (nonSystemDefaultFieldStartIndex >= 0 && prevIndex !== currIndex) {
      const droppedField = event.item.data;
      const targetField = this.dataFieldDataSource.data[currIndex];
      this.saveDataField({
        ...droppedField,
        displayOrder: targetField.displayOrder,
      });
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
