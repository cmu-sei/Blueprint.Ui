/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService } from '@cmusei/crucible-common';
import { User as AuthUser } from 'oidc-client';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  ReplaySubject,
  Subject,
} from 'rxjs';
import { filter, map, take, takeUntil } from 'rxjs/operators';
import {
  PermissionService,
  UserPermissionService,
  UserService,
} from 'src/app/generated/blueprint.api/api/api';
import {
  Permission,
  User,
  UserPermission,
} from 'src/app/generated/blueprint.api/model/models';

@Injectable({
  providedIn: 'root',
})
export class UserDataService implements OnDestroy {
  requestedUserId: Observable<string> | undefined;
  unsubscribe$: Subject<null> = new Subject<null>();
  readonly filterControl = new UntypedFormControl();
  readonly userList: Observable<User[]>;
  readonly userListTotalLength: Observable<number>;
  readonly selectedUser: Observable<User>;
  readonly loggedInUser: BehaviorSubject<AuthUser> =
    new BehaviorSubject<AuthUser>(null);
  readonly isAuthorizedUser = new BehaviorSubject<boolean>(false);
  readonly isSuperUser = new ReplaySubject<boolean>(1);
  readonly canModify = new BehaviorSubject<boolean>(false);
  readonly canSubmit = new BehaviorSubject<boolean>(false);
  readonly canIncrementMove = new BehaviorSubject<boolean>(false);
  readonly isContentDeveloper = new BehaviorSubject<boolean>(false);
  readonly canAccessAdminSection = new BehaviorSubject<boolean>(false);
  private _permissions: Permission[] = [];
  private _users: User[] = [];
  readonly users = new BehaviorSubject<User[]>(this._users);
  private loggedInUserPermissions: Permission[] = [];
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private userService: UserService,
    private userPermissionService: UserPermissionService,
    private permissionService: PermissionService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {
    this.authQuery.user$
      .pipe(
        filter((user: AuthUser) => user != null),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((authUser) => {
        // For some reason I can't get this to work without this helper function.
        // Modled after player - logged-in-user-service
        this.setLoggedInUser(authUser);
      });

    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('filter') || '')
    );
    this.sortColumn = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('sorton') || 'name')
    );
    this.sortIsAscending = activatedRoute.queryParamMap.pipe(
      map((params) => (params.get('sortdir') || 'asc') === 'asc')
    );
    this.pageSize = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pagesize') || '20', 10))
    );
    this.pageIndex = activatedRoute.queryParamMap.pipe(
      map((params) => parseInt(params.get('pageindex') || '0', 10))
    );
    this.filterControl.valueChanges.subscribe((term) => {
      router.navigate([], {
        queryParams: { filter: term },
        queryParamsHandling: 'merge',
      });
    });
    this.userList = combineLatest([
      this.users,
      this.filterTerm,
      this.sortColumn,
      this.sortIsAscending,
      this.pageSize,
      this.pageIndex,
    ]).pipe(
      map(
        ([
          users,
          filterTerm,
          sortColumn,
          sortIsAscending,
          pageSize,
          pageIndex,
        ]) =>
          users
            ? (users as User[])
                .sort((a: User, b: User) =>
                  this.sortUsers(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (user) =>
                    user.name
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()) ||
                    user.id.toLowerCase().includes(filterTerm.toLowerCase())
                )
            : []
      )
    );
    this.requestedUserId = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('userId') || '')
    );
    this.selectedUser = combineLatest([
      this.userList,
      this.requestedUserId,
    ]).pipe(
      map(([userList, requestedUserId]) => {
        const selectedUser = userList.find(
          (user) => user.id === requestedUserId
        );
        return selectedUser ? selectedUser : userList[0];
      })
    );
  }

  setLoggedInUser(authUser: AuthUser) {
    this.userService
      .getUser(authUser.profile.sub)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((user) => {
        const permissions = user.permissions;
        // merge blueprint user into authUser for the topbar component.
        authUser.profile = { ...authUser.profile, ...user };
        // for authorized user, sub is a uuid of length 36
        this.isAuthorizedUser.next(authUser.profile.sub.length === 36);
        const isSuperUser = permissions.some((p) => p.key === 'SystemAdmin');
        const isContentDeveloper = permissions.some(
          (p) => p.key === 'ContentDeveloper'
        );
        authUser.profile.isSystemAdmin = isSuperUser;
        this.isSuperUser.next(isSuperUser);
        this.isContentDeveloper.next(isContentDeveloper || isSuperUser);
        this.canAccessAdminSection.next(isSuperUser);
        // Emit the modified user.
        this.loggedInUser.next(authUser);
      });
  }

  setActive(id: string) {
    this.router.navigate([], {
      queryParams: { userId: id },
      queryParamsHandling: 'merge',
    });
  }

  getUsersFromApi() {
    return this.userService
      .getUsers()
      .pipe(take(1))
      .subscribe(
        (users) => {
          this.updateUsers(users);
        },
        (error) => {
          this.updateUsers([]);
        }
      );
  }

  getMselUsers(mselId: string) {
    return this.userService
      .getMselUsers(mselId)
      .pipe(take(1))
      .subscribe(
        (users) => {
          this.updateUsers(users);
        },
        (error) => {
          this.updateUsers([]);
        }
      );
  }

  getPermissionsFromApi() {
    return this.permissionService.getPermissions().pipe(
      map(
        (permissions) => {
          this._permissions = permissions;
        },
        (error) => {
          this._permissions = [];
        }
      )
    );
  }

  addUser(user: User) {
    this.userService.createUser(user).subscribe((u) => {
      // condition added because sometimes signalR adds the item first
      if (!this._users.some((s) => s.id === u.id)) {
        this._users.unshift(u);
        this.updateUsers(this._users);
      }
    });
  }

  deleteUser(user: User) {
    this.userService.deleteUser(user.id).subscribe((response) => {
      this._users = this._users.filter((u) => u.id !== user.id);
      this.updateUsers(this._users);
    });
  }

  addUserPermission(userPermission: UserPermission) {
    this.userPermissionService
      .createUserPermission(userPermission)
      .subscribe((response) => {
        const user = this._users.find((u) => u.id === userPermission.userId);
        const permission = this._permissions.find(
          (p) => p.id === userPermission.permissionId
        );
        user.permissions.push({ ...permission } as Permission);
        this.updateUsers(this._users);
      });
  }

  deleteUserPermission(userPermission: UserPermission) {
    this.userPermissionService
      .deleteUserPermissionByIds(
        userPermission.userId,
        userPermission.permissionId
      )
      .subscribe((up) => {
        const user = this._users.find((u) => u.id === userPermission.userId);
        const permissionIndex = user.permissions.findIndex(
          (p) => p.id === userPermission.permissionId
        );
        if (permissionIndex > -1) {
          user.permissions.splice(permissionIndex, 1);
        }
        this.updateUsers(this._users);
      });
  }

  updateStore(user: User) {
    const existingUserIndex = this._users.findIndex((u) => u.id === user.id);
    if (existingUserIndex >= 0) {
      this._users.splice(existingUserIndex, 1, user);
    } else {
      this._users.unshift(user);
    }
    this.updateUsers(this._users);
  }

  deleteFromStore(id: string) {
    const existingUserIndex = this._users.findIndex((u) => u.id === id);
    if (existingUserIndex >= 0) {
      this._users.splice(existingUserIndex, 1);
      this.updateUsers(this._users);
    }
  }

  logout() {
    this.authService.logout();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private updateUsers(users: User[]) {
    this._users = Object.assign([], users);
    this.users.next(this._users);
  }

  private sortUsers(a: User, b: User, column: string, isAsc: boolean) {
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case 'id':
        return (
          (a.id.toLowerCase() < b.id.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }
}
