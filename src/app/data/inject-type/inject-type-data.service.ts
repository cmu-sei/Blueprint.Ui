// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { InjectTypeStore } from './inject-type.store';
import { InjectTypeQuery } from './inject-type.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  InjectType,
  InjectTypeService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InjectTypeDataService {
  private _requestedInjectTypeId: string;
  private _requestedInjectTypeId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('injectTypeId') || '')
  );
  readonly InjectTypeList: Observable<InjectType[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private injectTypeStore: InjectTypeStore,
    private injectTypeQuery: InjectTypeQuery,
    private injectTypeService: InjectTypeService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('injectTypemask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { injectTypemask: term },
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
    this.InjectTypeList = combineLatest([
      this.injectTypeQuery.selectAll(),
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
            ? (items as InjectType[])
              .filter(
                (injectType) =>
                  injectType.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  load() {
    this.injectTypeStore.setLoading(true);
    this.injectTypeService
      .getInjectTypes()
      .pipe(
        tap(() => {
          this.injectTypeStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.injectTypeStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadById(id: string) {
    this.injectTypeStore.setLoading(true);
    return this.injectTypeService
      .getInjectType(id)
      .pipe(
        tap(() => {
          this.injectTypeStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.injectTypeStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.injectTypeStore.set([]);
  }

  add(injectType: InjectType) {
    this.injectTypeStore.setLoading(true);
    this.injectTypeService
      .createInjectType(injectType)
      .pipe(
        tap(() => {
          this.injectTypeStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.injectTypeStore.add(s);
      });
  }

  update(injectType: InjectType) {
    this.injectTypeStore.setLoading(true);
    this.injectTypeService
      .updateInjectType(injectType.id, injectType)
      .pipe(
        tap(() => {
          this.injectTypeStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.injectTypeService
      .deleteInjectType(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.injectTypeStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.injectTypeStore.update({ pageEvent: pageEvent });
  }

  updateStore(injectType: InjectType) {
    this.injectTypeStore.upsert(injectType.id, injectType);
  }

  deleteFromStore(id: string) {
    this.injectTypeStore.remove(id);
  }

}
