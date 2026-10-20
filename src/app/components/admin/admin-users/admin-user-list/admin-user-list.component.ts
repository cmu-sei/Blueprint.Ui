// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, EventEmitter, OnInit, ViewChild, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { User, SystemRole } from 'src/app/generated/blueprint.api';
import { SystemRoleDataService } from 'src/app/data/system-role/system-role-data.service';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { MatFormField, MatInput, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { MatOption } from '@angular/material/autocomplete';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
    selector: 'app-admin-user-list',
    templateUrl: './admin-user-list.component.html',
    styleUrls: ['./admin-user-list.component.scss'],
    imports: [MatIcon, MatFormField, MatInput, FormsModule, MatIconButton, MatSuffix, MatPaginator, MatTooltip, MatTable, MatSort, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatSortHeader, MatCellDef, MatCell, ClipboardModule, MatSelect, MatOption, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatCard, MatProgressSpinner, AsyncPipe]
})
export class AdminUserListComponent implements OnInit, OnChanges {
  private confirmService = inject(CrucibleDialogService);
  private roleDataService = inject(SystemRoleDataService);

  displayedColumns: string[] = ['id', 'name', 'role'];
  filterString = '';
  savedFilterString = '';
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  newUser: User = {};

  addingNewUser: boolean;
  roles$ = this.roleDataService.roles$;
  topbarColor = '#BB0000';

  @Input() users: User[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() create: EventEmitter<User> = new EventEmitter<User>();
  @Output() delete: EventEmitter<string> = new EventEmitter<string>();
  @Output() updateUser: EventEmitter<User> = new EventEmitter<User>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  ngOnInit() {
    if (this.paginator) {
      this.userDataSource.paginator = this.paginator;
    }
    this.userDataSource.sort = this.sort;
    this.roleDataService.getRoles().subscribe();
    this.filterAndSort(this.filterString);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!!changes.users && !!changes.users.currentValue) {
      this.userDataSource.data = changes.users.currentValue;
      this.filterAndSort(this.filterString);
    }
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  filterAndSort(filterValue: string) {
    this.userDataSource.filter = filterValue;
  }

  addNewUser(addUser: boolean) {
    if (addUser) {
      const user = {
        id: this.newUser.id,
        name: this.newUser.name,
      };
      this.savedFilterString = this.filterString;
      this.create.emit(user);
    }
    this.newUser = {};
    this.addingNewUser = false;
  }

  deleteUser(user: User) {
    this.confirmService
      .confirm({
        title: 'Delete ' + user.name + '?',
        message: user.id,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((result) => {
      if (result) {
        this.delete.emit(user.id);
      }
    });
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  updateRole(user: User, event: MatSelectChange) {
    const updatedUser = {
      ...user,
      roleId: event.value === '' ? null : event.value,
    };
    this.updateUser.emit(updatedUser);
  }
}
