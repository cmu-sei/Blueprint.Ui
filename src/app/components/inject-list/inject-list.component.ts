// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Injectm,
  InjectType,
  Team
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

@Component({
  selector: 'app-inject-list',
  templateUrl: './inject-list.component.html',
  styleUrls: ['./inject-list.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
      state('expanded', style({ height: '*', visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class InjectListComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() catalogId: string;
  @Input() injectTypeId: string;
  @ViewChild('injectTable', {static: false}) injectTable: MatTable<any>;
  contextMenuPosition = { x: '0px', y: '0px' };
  injectList: Injectm[] = [];
  changedInject: Injectm = {};
  filteredInjects: Injectm[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedInjects: Injectm[] = [];
  templateInjects: Injectm[] = [];
  editingId = '';
  injectDataSource = new MatTableDataSource<Injectm>(new Array<Injectm>());
  displayedColumns: string[] = ['action', 'name', 'description'];
  injectTypeList: InjectType[] = [];
  private unsubscribe$ = new Subject();
  isExpansionDetailRow = (i: number, row: Object) => (row as Injectm).id === this.expandedElementId;
  expandedElementId = '';

  constructor(
    private injectmDataService: InjectmDataService,
    private injectmQuery: InjectmQuery,
    public dialog: MatDialog,
    public dialogService: DialogService,
    private injectTypeQuery: InjectTypeQuery,
  ) {
    // subscribe to injects
    this.injectmQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(injects => {
      this.injectList = injects;
      this.sortChanged(this.sort);
    });
    // subscribe to InjectTypes
    this.injectTypeQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(injectTypes => {
      this.injectTypeList = injectTypes.sort((a, b) => a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1);
    });
    // subscribe to filter control changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
  }

  ngOnInit() {
    // load injects
    if (this.catalogId) {
      this.injectmDataService.loadByCatalog(this.catalogId);
    } else if (this.injectTypeId) {
      this.injectmDataService.loadByInjectType(this.injectTypeId);
    }
  }

  getSortedInjects(injects: Injectm[]) {
    if (injects) {
      injects.sort((a, b) => this.sortInjects(a, b, this.sort.active, this.sort.direction));
    }
    return injects;
  }

  addOrEditInject(inject: Injectm) {
    if (!inject) {
      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 30);
      inject = {
      };
    }
    const dialogRef = this.dialog.open(InjectEditDialogComponent, {
      width: '800px',
      data: {
        inject: inject,
        injectTypeList: this.injectTypeList,
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.inject) {
        this.saveInject(result.inject);
      }
      dialogRef.close();
    });
  }

  saveInject(inject: Injectm) {
    if (inject.id) {
      this.injectmDataService.update(inject);
    } else {
      inject.id = uuidv4();
      this.injectmDataService.add(this.catalogId, inject);
    }
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
          this.editingId = '';
        }
      });
  }

  copyInject(inject: Injectm): void {
    // this.injectDataService.copy(id);
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.injectDataSource.data = this.getSortedInjects(this.getFilteredInjects(this.injectList));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredInjects(injects: Injectm[]): Injectm[] {
    let filteredInjects: Injectm[] = [];
    if (injects) {
      injects.forEach(se => {
        filteredInjects.push({... se});
      });
      if (filteredInjects && filteredInjects.length > 0 && this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filteredInjects = filteredInjects.filter(inject => inject.name?.toLowerCase().includes(filterString));
      }
    }
    return filteredInjects;
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
        return ( (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'description':
        return ( (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
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
    const rowClass = this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
    return rowClass;
  }

  getInjectTypeName(injectTypeId: string) {
    const injectType = this.injectTypeList.find(m => m.id === injectTypeId);
    return injectType ? injectType.name : '';
  }

}
