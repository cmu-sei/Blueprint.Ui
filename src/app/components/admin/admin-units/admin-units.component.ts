// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Unit, User } from 'src/app/generated/blueprint.api/model/models';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserQuery } from 'src/app/data/user/user.query';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { AdminUnitEditDialogComponent } from 'src/app/components/admin/admin-unit-edit-dialog/admin-unit-edit-dialog.component';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
    selector: 'app-admin-units',
    templateUrl: './admin-units.component.html',
    styleUrls: ['./admin-units.component.scss'],
    animations: [
      trigger('detailExpand', [
        state('collapsed', style({ height: '0px', minHeight: '0', visibility: 'hidden' })),
        state('expanded', style({ height: '*', visibility: 'visible' })),
        transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      ]),
    ],
    standalone: false
})
export class AdminUnitsComponent implements OnDestroy {
  @Input() canManage: boolean;
  @ViewChild('unitTable', { static: false }) unitTable: MatTable<any>;
  @ViewChild(MatPaginator) set matPaginator(paginator: MatPaginator) {
    this.unitDataSource.paginator = paginator;
  }
  userList: User[] = [];
  allUnits: Unit[] = [];
  unitList: Unit[] = [];
  filterString = '';
  sort: Sort = { active: 'shortName', direction: 'asc' };
  isLoading = false;
  topbarColor = '#ef3a47';
  addingNewUnit = false;
  newUnitName = '';
  defaultScoringModelId = this.settingsService.settings.DefaultScoringModelId;
  unitDataSource = new MatTableDataSource<Unit>(new Array<Unit>());
  displayedColumns: string[] = ['action', 'shortName', 'name'];
  expandedElementId = '';
  isExpansionDetailRow = (i: number, row: Object) => (row as Unit).id === this.expandedElementId;
  private unsubscribe$ = new Subject();

  constructor(
    private settingsService: ComnSettingsService,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private unitDataService: UnitDataService,
    private unitQuery: UnitQuery,
    private userQuery: UserQuery
  ) {
    // subscribe to all units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      this.allUnits = units;
      this.applyFilter(this.filterString);
    });
    // load the units
    this.unitDataService.load();
    // subscribe to all users
    this.userQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
  }

  addOrEditUnit(unit: Unit) {
    if (!unit) {
      unit = {
        name: '',
        shortName: ''
      };
    } else {
      unit = { ...unit };
    }
    const dialogRef = this.dialog.open(AdminUnitEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
      data: {
        unit: unit,
        userList: this.userList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.unit) {
        this.saveUnit(result.unit);
      }
      dialogRef.close();
    });
  }

  saveUnit(unit: Unit) {
    if (unit.id) {
      this.unitDataService.updateUnit(unit);
    } else {
      this.unitDataService.add(unit);
    }
  }

  deleteUnit(unit: Unit): void {
    this.dialogService
      .confirm(
        'Delete Unit',
        'Are you sure that you want to delete ' + unit.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.unitDataService.delete(unit.id);
        }
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.toLowerCase();
    this.unitList = this.allUnits
      .filter(unit =>
        unit.name.toLowerCase().indexOf(filterValue) >= 0 ||
        unit.shortName.toLowerCase().indexOf(filterValue) >= 0)
      .sort((a, b) => this.sortUnits(a, b));
    this.unitDataSource.data = this.unitList;
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortUnits(a: Unit, b: Unit): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    switch (this.sort.active) {
      case 'name':
        return a.name.toLowerCase() < b.name.toLowerCase() ? -dir : dir;
        break;
      default:
        return a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -dir : dir;
        break;
    }
  }

  rowClicked(row: Unit) {
    if (this.expandedElementId === row.id) {
      this.expandedElementId = '';
    } else {
      this.expandedElementId = row.id;
    }
    this.unitTable.renderRows();
  }

  getRowClass(id: string) {
    const rowClass = this.expandedElementId === id
      ? 'element-row element-row-expanded'
      : 'element-row element-row-not-expanded';
    return rowClass;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
