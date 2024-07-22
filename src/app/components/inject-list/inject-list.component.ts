// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Catalog,
  DataField,
  DataValue,
  Injectm,
  InjectType,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatTable } from '@angular/material/table';
import { InjectmDataService } from 'src/app/data/injectm/injectm-data.service';
import { InjectmQuery } from 'src/app/data/injectm/injectm.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { InjectEditDialogComponent } from '../inject-edit-dialog/inject-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { InjectTypeQuery } from 'src/app/data/inject-type/inject-type.query';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserDataService } from 'src/app/data/user/user-data.service';

@Component({
  selector: 'app-inject-list',
  templateUrl: './inject-list.component.html',
  styleUrls: ['./inject-list.component.scss'],
  animations: [
    trigger('detailExpand', [
      state(
        'collapsed',
        style({ height: '0px', minHeight: '0', visibility: 'hidden' })
      ),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ),
    ]),
  ],
})
export class InjectListComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() isEditMode: boolean;
  @Input() catalog: Catalog = {};
  @Input() injectType: InjectType = {};
  @Output() selectedInjectIdList = new EventEmitter<string[]>();
  @ViewChild('injectTable', { static: false }) injectTable: MatTable<any>;
  contextMenuPosition = { x: '0px', y: '0px' };
  injectList: Injectm[] = [];
  selectedInjectIds: string[] = [];
  changedInject: Injectm = {};
  filteredInjects: Injectm[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = { active: 'name', direction: 'asc' };
  sortedInjects: Injectm[] = [];
  allInjectsOfType: Injectm[] = [];
  dataFieldList: DataField[] = [];
  injectDataSource = new MatTableDataSource<Injectm>(new Array<Injectm>());
  displayedColumns: string[] = ['action', 'name', 'description'];
  displayedDataFields: DataField[] = [];
  injectTypeList: InjectType[] = [];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) =>
    (row as Injectm).id === this.expandedElementId;
  expandedElementId = '';
  unitList = [];
  userList = [];

  constructor(
    private injectmDataService: InjectmDataService,
    private injectmQuery: InjectmQuery,
    public dialog: MatDialog,
    public dialogService: DialogService,
    private injectTypeQuery: InjectTypeQuery,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private unitQuery: UnitQuery,
    private userDataService: UserDataService
  ) {
    // subscribe to injects
    this.injectmQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((injects) => {
        this.injectList = [];
        // get editable objects
        injects.forEach((m) => {
          const inject = { ...m };
          inject.dataValues = [];
          m.dataValues.forEach((dv) => {
            inject.dataValues.push({ ...dv });
          });
          this.injectList.push(inject);
        });
        this.sortChanged(this.sort);
      });
    // subscribe to InjectTypes
    this.injectTypeQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((injectTypes) => {
        this.injectTypeList = injectTypes.sort((a, b) =>
          a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1
        );
      });
    // subscribe to dataFields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.dataFieldList = dataFields.sort((a, b) =>
          +a.displayOrder > +b.displayOrder ? 1 : -1
        );
      });
    // subscribe to filter control changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
    // subscribe to users
    this.userDataService.userList
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((users) => {
        this.userList = users;
      });
    // subscribe to units
    this.unitQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((units) => {
        this.unitList = units;
      });
  }

  ngOnInit() {
    // load injects
    if (this.catalog.id) {
      this.injectmDataService.loadByCatalog(this.catalog.id);
      this.dataFieldDataService.loadByInjectType(this.catalog.injectTypeId);
    }
    if (this.injectType.id) {
      this.injectmDataService.loadByInjectType(this.injectType.id);
      this.dataFieldDataService.loadByInjectType(this.injectType.id);
    }
  }

  getSortedInjects(injects: Injectm[]) {
    if (injects) {
      injects.sort((a, b) =>
        this.sortInjects(a, b, this.sort.active, this.sort.direction)
      );
    }
    return injects;
  }

  addInject() {
    const inject = {
      id: uuidv4(),
      injectTypeId: this.catalog.id
        ? this.catalog.injectTypeId
        : this.injectType.id,
    } as Injectm;
    inject.dataValues = this.createNewDataValues(inject.id);
    this.editInject(inject, true);
  }

  copyInject(inject: Injectm): void {
    const newInjectId = uuidv4();
    const newInject: Injectm = {};
    Object.assign(newInject, inject);
    newInject.id = newInjectId;
    newInject.dataValues = [];
    inject.dataValues.forEach((dv) => {
      const newDataValue: DataValue = {};
      Object.assign(newDataValue, dv);
      newDataValue.id = uuidv4();
      newDataValue.injectId = newInjectId;
      newInject.dataValues.push(newDataValue);
    });
    this.editInject(newInject, true);
  }

  editInject(inject: Injectm, isNewInject?: boolean) {
    const dialogRef = this.dialog.open(InjectEditDialogComponent, {
      width: '800px',
      data: {
        inject: inject,
        dataFieldList: this.dataFieldList,
        isEditMode: this.isEditMode,
        unitList: this.unitList,
        userList: this.userList,
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.inject) {
        // save the inject (add or update)
        if (isNewInject) {
          this.injectmDataService.add(this.catalog.id, result.inject);
        } else {
          this.injectmDataService.update(result.inject);
        }
      }
      dialogRef.close();
    });
  }

  deleteInject(inject: Injectm): void {
    this.dialogService
      .confirm(
        'Delete Inject',
        'Are you sure that you want to delete ' + inject.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.injectmDataService.delete(inject.id);
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.injectDataSource.data = this.getSortedInjects(
      this.getFilteredInjects(this.injectList)
    );
  }

  getFilteredInjects(injects: Injectm[]): Injectm[] {
    if (injects && injects.length > 0 && this.filterString) {
      const filterString = this.filterString?.toLowerCase();
      injects = injects.filter((inject) =>
        inject.name?.toLowerCase().includes(filterString)
      );
    }
    return injects;
  }

  private sortInjects(
    a: Injectm,
    b: Injectm,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
        break;
      default:
        return 0;
    }
  }

  rowClicked(row: Injectm) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.injectTable.renderRows();
  }

  getRowClass(id: string) {
    const rowClass =
      this.expandedElementId === id
        ? 'element-row element-row-expanded'
        : 'element-row element-row-not-expanded';
    return rowClass;
  }

  getInjectTypeName(injectTypeId: string) {
    const injectType = this.injectTypeList.find((m) => m.id === injectTypeId);
    return injectType ? injectType.name : '';
  }

  createNewDataValues(injectId: string): DataValue[] {
    const dataValues = [];
    this.dataFieldList.forEach((df) => {
      const dv: DataValue = {
        id: uuidv4(),
        injectId: injectId,
        dataFieldId: df.id,
        value: null,
      };
      dataValues.push(dv);
    });
    return dataValues;
  }

  isSelected(id: string): boolean {
    return this.selectedInjectIds.some((m) => m === id);
  }

  select(id: string) {
    const index = this.selectedInjectIds.indexOf(id);
    if (index > -1) {
      this.selectedInjectIds.splice(index, 1);
    } else {
      this.selectedInjectIds.push(id);
    }
    this.selectedInjectIdList.emit(this.selectedInjectIds);
  }

  getDisplayedColumns(): string[] {
    const dataFields = this.getDisplayedDataFields().sort((a, b) =>
      +a.displayOrder < +b.displayOrder ? -1 : 1
    );
    const displayedColumns = this.displayedColumns.slice(0);
    dataFields.forEach((df) => {
      displayedColumns.push(df.name);
    });
    return displayedColumns;
  }

  getDisplayedDataFields(): DataField[] {
    const displayedDataFields = [];
    this.dataFieldList.forEach((df) => {
      if (this.catalog.listDataFields.indexOf(df.id) > -1) {
        displayedDataFields.push(df);
      }
    });
    return displayedDataFields;
  }

  getDataValue(inject: Injectm, dataField: DataField): DataValue {
    const dataValue = inject.dataValues.find(
      (dv) => dv.dataFieldId === dataField.id
    );
    return dataValue ? dataValue : ({} as DataValue);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
