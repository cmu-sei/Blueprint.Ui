// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Group, SystemPermission } from 'src/app/generated/blueprint.api';
import { GroupDataService } from 'src/app/data/group/group-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-admin-groups',
  templateUrl: './admin-groups.component.html',
  styleUrls: ['./admin-groups.component.scss'],
  standalone: false,
})
export class AdminGroupsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatSort) sort: MatSort;

  private unsubscribe$ = new Subject<void>();

  filterString = '';
  displayedColumns: string[] = ['name', 'actions'];
  dataSource: MatTableDataSource<Group> = new MatTableDataSource();
  canEdit = false;

  newGroupName = '';
  isAddingGroup = false;
  editingGroupId: string | null = null;
  editingGroupName = '';

  dataSource$ = this.groupDataService.groups$.pipe(
    map((groups) => {
      this.dataSource.data = groups;
      return this.dataSource;
    })
  );

  constructor(
    private groupDataService: GroupDataService,
    private permissionDataService: PermissionDataService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    this.canEdit = this.permissionDataService.hasPermission(
      SystemPermission.ManageGroups
    );
    this.groupDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  applyFilter(filterValue: string): void {
    this.filterString = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter(): void {
    this.applyFilter('');
  }

  startAddGroup(): void {
    this.isAddingGroup = true;
    this.newGroupName = '';
  }

  cancelAddGroup(): void {
    this.isAddingGroup = false;
    this.newGroupName = '';
  }

  createGroup(): void {
    if (this.newGroupName.trim()) {
      this.groupDataService
        .create({ name: this.newGroupName.trim() })
        .subscribe(() => {
          this.isAddingGroup = false;
          this.newGroupName = '';
        });
    }
  }

  startEditGroup(group: Group): void {
    this.editingGroupId = group.id;
    this.editingGroupName = group.name || '';
  }

  cancelEditGroup(): void {
    this.editingGroupId = null;
    this.editingGroupName = '';
  }

  saveGroupName(group: Group): void {
    if (this.editingGroupName.trim()) {
      const updatedGroup = { ...group, name: this.editingGroupName.trim() };
      this.groupDataService.edit(updatedGroup).subscribe(() => {
        this.editingGroupId = null;
        this.editingGroupName = '';
      });
    }
  }

  deleteGroup(group: Group): void {
    this.dialogService
      .confirm(
        'Delete Group',
        `Are you sure you want to delete "${group.name}"?`
      )
      .subscribe((result) => {
        if (result && result['confirm']) {
          this.groupDataService.delete(group.id).subscribe();
        }
      });
  }

  handleInput(event: KeyboardEvent): void {
    event.stopPropagation();
  }
}
