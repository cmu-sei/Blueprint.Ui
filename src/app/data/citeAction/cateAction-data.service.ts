// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { CiteActionStore } from './citeAction.store';
import { CiteActionQuery } from './citeAction.query';
import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CiteAction,
  CiteActionService,
  ItemStatus
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CiteActionDataService {
  private _requestedCiteActionId: string;
  private _requestedCiteActionId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('citeActionId') || '')
  );
  readonly CiteActionList: Observable<CiteAction[]>;
  readonly filterControl = new FormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private citeActionStore: CiteActionStore,
    private citeActionQuery: CiteActionQuery,
    private citeActionService: CiteActionService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('citeActionmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { citeActionmask: term },
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
    this.CiteActionList = combineLatest([
      this.citeActionQuery.selectAll(),
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
            ? (items as CiteAction[])
                .sort((a: CiteAction, b: CiteAction) =>
                  this.sortCiteActions(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (citeAction) =>
                    ('' + citeAction.description)
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()) ||
                    citeAction.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
                )
            : []
      )
    );
  }

  private sortCiteActions(
    a: CiteAction,
    b: CiteAction,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
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

  loadByMsel(mselId: string) {
    this.citeActionStore.setLoading(true);
    this.citeActionService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.citeActionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (citeActions) => {
          this.citeActionStore.set(citeActions);
        },
        (error) => {
          this.citeActionStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.citeActionStore.setLoading(true);
    return this.citeActionService
      .getCiteAction(id)
      .pipe(
        tap(() => {
          this.citeActionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeActionStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.citeActionStore.set([]);
  }

  add(citeAction: CiteAction) {
    this.citeActionStore.setLoading(true);
    this.citeActionService
      .createCiteAction(citeAction)
      .pipe(
        tap(() => {
          this.citeActionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeActionStore.add(s);
      });
  }

  updateCiteAction(citeAction: CiteAction) {
    this.citeActionStore.setLoading(true);
    this.citeActionService
      .updateCiteAction(citeAction.id, citeAction)
      .pipe(
        tap(() => {
          this.citeActionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.citeActionService
      .deleteCiteAction(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.citeActionStore.update({ pageEvent: pageEvent });
  }

  updateStore(citeAction: CiteAction) {
    this.citeActionStore.upsert(citeAction.id, citeAction);
  }

  deleteFromStore(id: string) {
    this.citeActionStore.remove(id);
  }
}
