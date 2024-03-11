// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  Input,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { LegacyPageEvent as PageEvent, MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { User } from 'src/app/generated/blueprint.api';
import { UnitUserDataService } from 'src/app/data/user/unit-user-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';

@Component({
  selector: 'app-admin-unit-users',
  templateUrl: './admin-unit-users.component.html',
  styleUrls: ['./admin-unit-users.component.scss'],
})
export class AdminUnitUsersComponent implements OnDestroy, OnInit {
  @Input() unitId: string;
  userList: User[] = [];
  users: User[] = [];
  unitUsers: User[] = [];

  displayedUserColumns: string[] = ['name', 'id'];
  displayedUnitColumns: string[] = ['name', 'user'];
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  unitUserDataSource = new MatTableDataSource<User>(new Array<User>());
  filterControl = new UntypedFormControl();
  filterString = '';
  defaultPageSize = 20;
  pageEvent: PageEvent;
  private unsubscribe$ = new Subject();

  @ViewChild('usersInput') usersInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private unitUserDataService: UnitUserDataService,
    private userDataService: UserDataService
  ) {
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
      this.setDataSources();
    });
    this.unitUserDataService.unitUsers.pipe(takeUntil(this.unsubscribe$)).subscribe(tUsers => {
      this.unitUsers = tUsers;
      this.setDataSources();
    });
  }

  ngOnInit() {
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.userDataSource.sort = this.sort;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.defaultPageSize;
    this.unitUserDataService.unitUsers.pipe(takeUntil(this.unsubscribe$)).subscribe(tUsers => {
      this.unitUsers = tUsers;
      this.setDataSources();
    });
    this.unitUserDataService.getUnitUsersFromApi(this.unitId);
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.pageEvent.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.userDataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  getUserName(id: string) {
    const user = this.userList.find(u => u.id === id);
    return user ? user.name : '?';
  }

  setDataSources() {
    // Now that all of the observables are returned, process accordingly.
    // get users from the UnitUsers
    // sort the list and add it as the data source
    this.unitUserDataSource.data = this.unitUsers.sort((a, b) => {
      const aName = this.getUserName(a.id).toLowerCase();
      const bName = this.getUserName(b.id).toLowerCase();
      if (aName < bName) {
        return -1;
      } else if (aName > bName) {
        return 1;
      } else {
        return 0;
      }
    });
    const newAllUsers = !this.userList ? new Array<User>() : this.userList.slice(0);
    this.unitUserDataSource.data.forEach((tu) => {
      const index = newAllUsers.findIndex((u) => u.id === tu.id);
      if (index >= 0) {
        newAllUsers.splice(index, 1);
      }
    });
    this.userDataSource = new MatTableDataSource(newAllUsers);
    this.userDataSource.sort = this.sort;
    this.userDataSource.paginator = this.paginator;
  }

  addUserToUnit(user: User): void {
    const index = this.unitUserDataSource.data.findIndex(
      (tu) => tu.id === user.id
    );
    if (index === -1) {
      this.unitUserDataService.addUserToUnit(this.unitId, user);
    }
  }

  /**
   * Removes a user from the current unit
   * @param user The user to remove from unit
   */
  removeUserFromUnit(user: User): void {
    const index = this.unitUserDataSource.data.findIndex(
      (tu) => tu.id === user.id
    );
    if (index !== -1) {
      this.unitUserDataService.removeUnitUser(this.unitId, user.id);
    }
  }

  compare(a: string, b: string, isAsc: boolean) {
    if (a === null || b === null) {
      return 0;
    } else {
      return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
