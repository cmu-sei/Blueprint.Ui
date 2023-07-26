// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Input, OnDestroy } from '@angular/core';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Sort } from '@angular/material/sort';
import {
  Permission,
  User,
  UserPermission,
} from 'src/app/generated/blueprint.api/model/models';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { Subject, takeUntil } from 'rxjs';
import { PermissionService } from 'src/app/generated/blueprint.api';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnDestroy {
  @Input() allUsers: User[];
  @Input() permissionList: Permission[];
  userList: User[] = [];
  filterString = '';
  pageEvent: PageEvent;
  pageIndex = 0;
  pageSize = 20;
  sort: Sort = { active: 'name', direction: 'asc' };
  addingNewUser = false;
  newUser: User = { id: '', name: '' };
  isLoading = false;
  topbarColor = '#ef3a47';
  private unsubscribe$ = new Subject();

  constructor(
    public dialogService: DialogService,
    private settingsService: ComnSettingsService,
    private userDataService: UserDataService,
    private permissionService: PermissionService
  ) {
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    // subscribe to permissions
    this.permissionService.getPermissions().pipe(takeUntil(this.unsubscribe$)).subscribe(permissions => {
      this.permissionList = permissions;
    });
    // subscribe to all users
    this.userDataService.userList.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.allUsers = users;
      this.applyFilter(this.filterString);
    });
  }

  hasPermission(permissionId: string, user: User) {
    return user.permissions.some((p) => p.id === permissionId);
  }

  toggleUserPermission(user: User, permissionId: string) {
    const userPermission: UserPermission = {
      userId: user.id,
      permissionId: permissionId,
    };
    if (this.hasPermission(permissionId, user)) {
      this.userDataService.deleteUserPermission(userPermission);
    } else {
      this.userDataService.addUserPermission(userPermission);
    }
  }

  addUserRequest(isAdd: boolean) {
    if (isAdd) {
      this.userDataService.addUser(this.newUser);
    }
    this.newUser.id = '';
    this.newUser.name = '';
    this.addingNewUser = false;
  }

  deleteUserRequest(user: User) {
    this.dialogService
      .confirm(
        'Delete User',
        'Are you sure that you want to delete ' + user.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.userDataService.deleteUser(user);
        }
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.pageIndex = 0;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.userList = this.allUsers
      .filter(user => user.name.toLowerCase().indexOf(filterValue) >= 0)
      .sort((a, b) => this.sortUsers(a, b));
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.applyFilter(this.filterString);
  }

  sortUsers(a: User, b: User): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    if (!this.sort.direction || this.sort.active === 'name') {
      this.sort = { active: 'name', direction: 'asc' };
      return a.name.toLowerCase() < b.name.toLowerCase() ? -dir : dir;
    } else {
      const aValue = this.hasPermission(this.sort.active, a).toString();
      const bValue = this.hasPermission(this.sort.active, b).toString();
      if (aValue === bValue) {
        return a.name.toLowerCase() < b.name.toLowerCase() ? -dir : dir;
      } else {
        return aValue < bValue ? dir : -dir;
      }
    }
  }

  paginatorEvent(page: PageEvent) {
    this.pageIndex = page.pageIndex;
    this.pageSize = page.pageSize;
  }

  paginateUsers(pageIndex: number, pageSize: number) {
    if (!this.userList) {
      return [];
    }
    const startIndex = pageIndex * pageSize;
    const copy = this.userList.slice();
    return copy.splice(startIndex, pageSize);
  }





  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
