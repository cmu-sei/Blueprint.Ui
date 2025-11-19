// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Unit, User } from 'src/app/generated/blueprint.api/model/models';
import { UnitDataService } from 'src/app/data/unit/unit-data.service';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
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
})
export class AdminUnitsComponent implements OnDestroy {
  userList: User[] = [];
  allUnits: Unit[] = [];
  unitList: Unit[] = [];
  filterString = '';
  pageEvent: PageEvent;
  pageIndex = 0;
  pageSize = 20;
  sort: Sort = { active: 'shortName', direction: 'asc' };
  newUnit: Unit = { id: '', name: '' };
  isLoading = false;
  topbarColor = '#ef3a47';
  addingNewUnit = false;
  newUnitName = '';
  editUnit: Unit = {};
  originalUnitName = '';
  originalUnitShortName = '';
  defaultScoringModelId = this.settingsService.settings.DefaultScoringModelId;
  private unsubscribe$ = new Subject();

  constructor(
    private settingsService: ComnSettingsService,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private unitDataService: UnitDataService,
    private unitQuery: UnitQuery,
    private userDataService: UserDataService
  ) {
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    // subscribe to all units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      this.allUnits = units;
      this.applyFilter(this.filterString);
    });
    // load the units
    this.unitDataService.load();
    // subscribe to all users
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
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
      width: '800px',
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

  togglePanel(unit: Unit) {
    this.editUnit = this.editUnit.id === unit.id ? this.editUnit = {} : this.editUnit = { ...unit };
  }

  selectUnit(unit: Unit) {
    this.editUnit = { ...unit };
    this.originalUnitName = unit.name;
    this.originalUnitShortName = unit.shortName;
    return false;
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
    this.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.unitList = this.allUnits
      .filter(unit =>
        unit.name.toLowerCase().indexOf(filterValue) >= 0 ||
        unit.shortName.toLowerCase().indexOf(filterValue) >= 0)
      .sort((a, b) => this.sortUnits(a, b));
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

  paginatorEvent(page: PageEvent) {
    this.pageIndex = page.pageIndex;
    this.pageSize = page.pageSize;
  }

  paginateUnits(pageIndex: number, pageSize: number) {
    if (!this.unitList) {
      return [];
    }
    const startIndex = pageIndex * pageSize;
    const copy = this.unitList.slice();
    return copy.splice(startIndex, pageSize);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
