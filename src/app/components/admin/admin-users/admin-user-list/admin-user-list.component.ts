// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  EventEmitter,
  OnInit,
  ViewChild,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort, Sort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmDialogComponent } from 'src/app/components/shared/confirm-dialog/confirm-dialog.component';
import { User, SystemRole } from 'src/app/generated/blueprint.api';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  fromMatSort,
  sortRows,
  fromMatPaginator,
  paginateRows,
} from 'src/app/datasource-utils';
import { SystemRoleDataService } from 'src/app/data/system-role/system-role-data.service';
import { MatSelectChange } from '@angular/material/select';

const WAS_CANCELLED = 'wasCancelled';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'app-admin-user-list',
  templateUrl: './admin-user-list.component.html',
  styleUrls: ['./admin-user-list.component.scss'],
  standalone: false
})
export class AdminUserListComponent implements OnInit, OnChanges {
  displayedColumns: string[] = ['id', 'name'];
  filterString = '';
  savedFilterString = '';
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  newUser: User = {};

  // MatPaginator Output
  pageEvent: PageEvent;
  addingNewUser: boolean;
  displayedRows$: Observable<User[]>;
  totalRows$: Observable<number>;
  sortEvents$: Observable<Sort>;
  pageEvents$: Observable<PageEvent>;
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

  constructor(
    private dialog: MatDialog,
    private roleDataService: SystemRoleDataService
  ) { }

  /**
   * Initialization
   */
  ngOnInit() {
    this.sortEvents$ = fromMatSort(this.sort);
    this.pageEvents$ = fromMatPaginator(this.paginator);
    this.roleDataService.getRoles().subscribe();
    this.filterAndSort(this.filterString);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!!changes.users && !!changes.users.currentValue) {
      this.userDataSource.data = changes.users.currentValue;
      this.filterAndSort(this.filterString);
    }
  }

  /**
   * Called by UI to add a filter to the userDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  /**
   * filters and sorts the displayed rows
   */
  filterAndSort(filterValue: string) {
    this.userDataSource.filter = filterValue;
    const rows$ = of(this.userDataSource.filteredData);
    this.totalRows$ = rows$.pipe(map((rows) => rows.length));
    if (!!this.sortEvents$ && !!this.pageEvents$) {
      this.displayedRows$ = rows$.pipe(
        sortRows(this.sortEvents$),
        paginateRows(this.pageEvents$)
      );
    }
  }

  /**
   * Adds a new user
   */
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
    this.confirmDialog('Delete ' + user.name + '?', user.id, {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED] && result['confirm']) {
        this.delete.emit(user.id);
      }
    });
  }

  confirmDialog(
    title: string,
    message: string,
    data?: any
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: data || {},
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
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
