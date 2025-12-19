// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { UserTeamRoleStore } from './user-team-role.store';
import { UserTeamRoleQuery } from './user-team-role.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  UserTeamRole,
  UserTeamRoleService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserTeamRoleDataService {
  private _requestedUserTeamRoleId: string;
  private _requestedUserTeamRoleId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('userTeamRoleId') || '')
  );
  readonly UserTeamRoleList: Observable<UserTeamRole[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private userTeamRoleStore: UserTeamRoleStore,
    private userTeamRoleQuery: UserTeamRoleQuery,
    private userTeamRoleService: UserTeamRoleService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
  }

  private sortUserTeamRoles(
    a: UserTeamRole,
    b: UserTeamRole,
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
    this.userTeamRoleStore.setLoading(true);
    this.userTeamRoleService
      .getUserTeamRolesByMsel(mselId)
      .pipe(
        tap(() => {
          this.userTeamRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (userTeamRoles) => {
          userTeamRoles.forEach(a => {
            this.setAsDates(a);
          });
          this.userTeamRoleStore.set(userTeamRoles);
        },
        (error) => {
          this.userTeamRoleStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.userTeamRoleStore.setLoading(true);
    return this.userTeamRoleService
      .getUserTeamRole(id)
      .pipe(
        tap(() => {
          this.userTeamRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.userTeamRoleStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.userTeamRoleStore.set([]);
  }

  add(userTeamRole: UserTeamRole) {
    this.userTeamRoleStore.setLoading(true);
    this.userTeamRoleService
      .createUserTeamRole(userTeamRole)
      .pipe(
        tap(() => {
          this.userTeamRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.userTeamRoleStore.add(s);
      });
  }

  delete(id: string) {
    this.userTeamRoleService
      .deleteUserTeamRole(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.userTeamRoleStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.userTeamRoleStore.update({ pageEvent: pageEvent });
  }

  updateStore(userTeamRole: UserTeamRole) {
    this.userTeamRoleStore.upsert(userTeamRole.id, userTeamRole);
  }

  deleteFromStore(id: string) {
    this.userTeamRoleStore.remove(id);
  }

  setAsDates(userTeamRole: UserTeamRole) {
    // set to a date object.
    userTeamRole.dateCreated = new Date(userTeamRole.dateCreated);
    userTeamRole.dateModified = new Date(userTeamRole.dateModified);
  }

}
