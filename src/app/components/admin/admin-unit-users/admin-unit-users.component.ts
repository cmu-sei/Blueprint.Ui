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
  AfterViewInit,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { User } from 'src/app/generated/blueprint.api';
import { UnitUserDataService } from 'src/app/data/user/unit-user-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';

@Component({
    selector: 'app-admin-unit-users',
    templateUrl: './admin-unit-users.component.html',
    styleUrls: ['./admin-unit-users.component.scss'],
    standalone: false
})
export class AdminUnitUsersComponent implements OnDestroy, OnInit, AfterViewInit {
  @Input() unitId: string;
  @Input() canManage: boolean;
  @ViewChild('userPaginator') userPaginator: MatPaginator;
  @ViewChild('unitUserPaginator') unitUserPaginator: MatPaginator;
  userList: User[] = [];
  users: User[] = [];
  unitUsers: User[] = [];
  displayedUserColumns: string[] = ['name', 'id'];
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  unitUserDataSource = new MatTableDataSource<User>(new Array<User>());
  filterControl = new UntypedFormControl();
  unitUserFilterControl = new UntypedFormControl();
  filterString = '';
  unitUserFilterString = '';
  private unsubscribe$ = new Subject();
  sort: Sort = { active: 'name', direction: 'asc' };
  @ViewChild('usersInput') usersInput: ElementRef<HTMLInputElement>;

  constructor(
    private unitUserDataService: UnitUserDataService,
    private userQuery: UserQuery
  ) {
    this.userQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
      this.setDataSources();
    });
    this.unitUserDataService.unitUsers.pipe(takeUntil(this.unsubscribe$)).subscribe(tUsers => {
      this.unitUsers = tUsers;
      this.setDataSources();
    });
  }

  ngOnInit() {
    this.unitUserDataService.unitUsers.pipe(takeUntil(this.unsubscribe$)).subscribe(tUsers => {
      this.unitUsers = tUsers;
      this.setDataSources();
    });
    this.unitUserDataService.getUnitUsersFromApi(this.unitId);
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.filterString = this.filterControl.value;
      this.applyFilter();
    });
    this.unitUserFilterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.unitUserFilterString = this.unitUserFilterControl.value;
      this.applyUnitUserFilter();
    });
  }

  ngAfterViewInit() {
    this.userDataSource.paginator = this.userPaginator;
    this.unitUserDataSource.paginator = this.unitUserPaginator;
  }

  applyFilter() {
    const filterValue = this.filterControl.value ? this.filterControl.value.toLowerCase() : '';
    this.userDataSource.filter = filterValue;
  }

  clearFilter() {
    this.filterControl.setValue('');
  }

  applyUnitUserFilter() {
    const searchTerm = this.unitUserFilterControl.value ? this.unitUserFilterControl.value.toLowerCase() : '';
    const filteredUnitUsers = this.unitUsers.filter(user =>
      !searchTerm || (user.name && user.name.toLowerCase().includes(searchTerm))
    );
    this.sortUserUnitData(filteredUnitUsers);
  }

  clearUnitUserFilter() {
    this.unitUserFilterControl.setValue('');
  }

  getUserName(id: string) {
    const user = this.userList.find(u => u.id === id);
    return user ? user.name : '?';
  }

  setDataSources() {
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
    if (this.userPaginator) {
      this.userDataSource.paginator = this.userPaginator;
    }
    if (this.unitUserPaginator) {
      this.unitUserDataSource.paginator = this.unitUserPaginator;
    }
  }

  addUserToUnit(user: User): void {
    const index = this.unitUserDataSource.data.findIndex(
      (tu) => tu.id === user.id
    );
    if (index === -1) {
      this.unitUserDataService.addUserToUnit(this.unitId, user);
    }
  }

  onSortChange(sort: Sort) {
    this.sort = sort;
    this.sortUserData(this.userList);
  }

  sortUserData(data: User[]) {
    data.sort((a, b) => {
      const isAsc = this.sort.direction === 'asc';
      switch (this.sort.active) {
        case 'name':
          return this.compare(a.name, b.name, isAsc);
        case 'id':
          return this.compare(a.id, b.id, isAsc);
        default:
          return 0;
      }
    });
    this.userDataSource.data = data;
    if (this.userPaginator) {
      this.userDataSource.paginator = this.userPaginator;
    }
  }

  onSortUnitChange(sort: Sort) {
    this.sort = sort;
    this.sortUserUnitData(this.unitUsers);
  }

  sortUserUnitData(data: User[]) {
    data.sort((a, b) => {
      const isAsc = this.sort.direction === 'asc';
      switch (this.sort.active) {
        case 'name':
          return this.compare(a.name, b.name, isAsc);
        case 'id':
          return this.compare(a.id, b.id, isAsc);
        default:
          return 0;
      }
    });
    this.unitUserDataSource.data = data;
    if (this.unitUserPaginator) {
      this.unitUserDataSource.paginator = this.unitUserPaginator;
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
