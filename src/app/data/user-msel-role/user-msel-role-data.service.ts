// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { UserMselRoleStore } from './user-msel-role.store';
import { UserMselRoleQuery } from './user-msel-role.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  UserMselRole,
  UserMselRoleService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserMselRoleDataService {
  private _requestedUserMselRoleId: string;
  private _requestedUserMselRoleId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('userMselRoleId') || '')
  );
  readonly UserMselRoleList: Observable<UserMselRole[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private userMselRoleStore: UserMselRoleStore,
    private userMselRoleQuery: UserMselRoleQuery,
    private userMselRoleService: UserMselRoleService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
  }

  private sortUserMselRoles(
    a: UserMselRole,
    b: UserMselRole,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'dateCreated':
        return (
          (a.dateCreated.valueOf() < b.dateCreated.valueOf() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }

  loadByMsel(mselId: string) {
    this.userMselRoleStore.setLoading(true);
    this.userMselRoleService
      .getUserMselRolesByMsel(mselId)
      .pipe(
        tap(() => {
          this.userMselRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (userMselRoles) => {
          userMselRoles.forEach(a => {
            this.setAsDates(a);
          });
          this.userMselRoleStore.set(userMselRoles);
        },
        (error) => {
          this.userMselRoleStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.userMselRoleStore.setLoading(true);
    return this.userMselRoleService
      .getUserMselRole(id)
      .pipe(
        tap(() => {
          this.userMselRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.userMselRoleStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.userMselRoleStore.set([]);
  }

  add(userMselRole: UserMselRole) {
    this.userMselRoleStore.setLoading(true);
    this.userMselRoleService
      .createUserMselRole(userMselRole)
      .pipe(
        tap(() => {
          this.userMselRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.userMselRoleStore.add(s);
      });
  }

  delete(id: string) {
    this.userMselRoleService
      .deleteUserMselRole(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.userMselRoleStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.userMselRoleStore.update({ pageEvent: pageEvent });
  }

  updateStore(userMselRole: UserMselRole) {
    this.userMselRoleStore.upsert(userMselRole.id, userMselRole);
  }

  deleteFromStore(id: string) {
    this.userMselRoleStore.remove(id);
  }

  setAsDates(userMselRole: UserMselRole) {
    // set to a date object.
    userMselRole.dateCreated = new Date(userMselRole.dateCreated);
    userMselRole.dateModified = new Date(userMselRole.dateModified);
  }

}
