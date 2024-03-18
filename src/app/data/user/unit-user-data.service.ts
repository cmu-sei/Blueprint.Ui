/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComnAuthQuery, ComnAuthService } from '@cmusei/crucible-common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { UnitUserService, UserService } from 'src/app/generated/blueprint.api/api/api';
import { UnitUser, User } from 'src/app/generated/blueprint.api/model/models';

@Injectable({
  providedIn: 'root',
})
export class UnitUserDataService implements OnDestroy {
  unsubscribe$: Subject<null> = new Subject<null>();
  readonly filterControl = new UntypedFormControl();
  private _unitUsers: User[] = [];
  private _unitId = '';
  readonly unitUsers = new BehaviorSubject<User[]>(this._unitUsers);
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private userService: UserService,
    private unitUserService: UnitUserService,
    private authQuery: ComnAuthQuery,
    private authService: ComnAuthService,
    private router: Router,
    activatedRoute: ActivatedRoute
  ) {}

  getUnitUsersFromApi(unitId: string) {
    this._unitId = unitId;
    return this.userService
      .getUnitUsers(unitId)
      .pipe(take(1))
      .subscribe(
        (users) => {
          this.updateUnitUsers(users);
        },
        (error) => {
          this.updateUnitUsers([]);
        }
      );
  }

  addUserToUnit(unitId: string, user: User) {
    this.unitUserService.createUnitUser({unitId: unitId, userId: user.id}).subscribe(
      (tu) => {
        // condition added, because sometimes signalR returns the item first
        if (!this._unitUsers.some(u => u.id === user.id)) {
          this._unitUsers.unshift(user);
          this.updateUnitUsers(this._unitUsers);
        }
      }
    );
  }

  removeUnitUser(unitId: string, userId: string) {
    this.unitUserService.deleteUnitUserByIds(unitId, userId).subscribe(
      (response) => {
        this._unitUsers = this._unitUsers.filter((u) => u.id !== userId);
        this.updateUnitUsers(this._unitUsers);
      }
    );
  }

  updateStore(unitUser: UnitUser) {
    if (unitUser.unitId === this._unitId) {
      const updatedUnitUsers = this._unitUsers.filter(u => u.id !== unitUser.userId);
      updatedUnitUsers.unshift(unitUser.user);
      this.updateUnitUsers(updatedUnitUsers);
    }
  }

  deleteFromStore(unitUser: UnitUser) {
    if (unitUser.unitId === this._unitId) {
      const updatedUnitUsers = this._unitUsers.filter(u => u.id !== unitUser.userId);
      this.updateUnitUsers(updatedUnitUsers);
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private updateUnitUsers(users: User[]) {
    this._unitUsers = Object.assign([], users);
    this.unitUsers.next(this._unitUsers);
  }
}
