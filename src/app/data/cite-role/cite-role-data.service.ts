// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { CiteRoleStore } from './cite-role.store';
import { CiteRoleQuery } from './cite-role.query';
import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CiteRole,
  CiteRoleService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CiteRoleDataService {
  private _requestedCiteRoleId: string;
  private _requestedCiteRoleId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('citeRoleId') || '')
  );
  readonly CiteRoleList: Observable<CiteRole[]>;
  readonly filterControl = new FormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private citeRoleStore: CiteRoleStore,
    private citeRoleQuery: CiteRoleQuery,
    private citeRoleService: CiteRoleService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('citeRolemask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { citeRolemask: term },
        queryParamsHandling: 'merge',
      });
    });
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
    this.CiteRoleList = combineLatest([
      this.citeRoleQuery.selectAll(),
      this.filterTerm,
      this.sortColumn,
      this.sortIsAscending,
      this.pageSize,
      this.pageIndex,
    ]).pipe(
      map(
        ([
          items,
          filterTerm,
          sortColumn,
          sortIsAscending,
          pageSize,
          pageIndex,
        ]) =>
          items
            ? (items as CiteRole[])
              .sort((a: CiteRole, b: CiteRole) =>
                this.sortCiteRoles(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (citeRole) =>
                  ('' + citeRole.name)
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()) ||
                    citeRole.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  private sortCiteRoles(
    a: CiteRole,
    b: CiteRole,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case 'dateCreated':
        return (
          (a.dateCreated.valueOf() < b.dateCreated.valueOf() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }

  loadTemplates() {
    this.citeRoleStore.setLoading(true);
    this.citeRoleService
      .getCiteRoleTemplates()
      .pipe(
        tap(() => {
          this.citeRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.citeRoleStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadByMsel(mselId: string) {
    this.citeRoleStore.setLoading(true);
    this.citeRoleService
      .getRolesByMsel(mselId)
      .pipe(
        tap(() => {
          this.citeRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (citeRoles) => {
          this.citeRoleStore.set(citeRoles);
        },
        (error) => {
          this.citeRoleStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.citeRoleStore.setLoading(true);
    return this.citeRoleService
      .getCiteRole(id)
      .pipe(
        tap(() => {
          this.citeRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeRoleStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.citeRoleStore.set([]);
  }

  add(citeRole: CiteRole) {
    this.citeRoleStore.setLoading(true);
    this.citeRoleService
      .createCiteRole(citeRole)
      .pipe(
        tap(() => {
          this.citeRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeRoleStore.add(s);
      });
  }

  updateCiteRole(citeRole: CiteRole) {
    this.citeRoleStore.setLoading(true);
    this.citeRoleService
      .updateCiteRole(citeRole.id, citeRole)
      .pipe(
        tap(() => {
          this.citeRoleStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.citeRoleService
      .deleteCiteRole(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.citeRoleStore.update({ pageEvent: pageEvent });
  }

  updateStore(citeRole: CiteRole) {
    this.citeRoleStore.upsert(citeRole.id, citeRole);
  }

  deleteFromStore(id: string) {
    this.citeRoleStore.remove(id);
  }
}
