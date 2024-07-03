// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { InjectmStore } from './injectm.store';
import { InjectmQuery } from './injectm.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Injectm,
  InjectService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InjectmDataService {
  private _requestedInjectmId: string;
  private _requestedInjectmId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('injectmId') || '')
  );
  readonly InjectmList: Observable<Injectm[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private injectmStore: InjectmStore,
    private injectmQuery: InjectmQuery,
    private injectService: InjectService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('injectmmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { injectmmask: term },
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
    this.InjectmList = combineLatest([
      this.injectmQuery.selectAll(),
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
            ? (items as Injectm[])
              .filter(
                (injectm) =>
                  injectm.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  loadByCatalog(catalogId: string) {
    this.injectmStore.setLoading(true);
    this.injectService
      .getInjectsByCatalog(catalogId)
      .pipe(
        tap(() => {
          this.injectmStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (injectms) => {
          injectms.forEach(a => {
            this.setAsDates(a);
          });
          this.injectmStore.set(injectms);
        },
        (error) => {
          this.injectmStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.injectmStore.setLoading(true);
    return this.injectService
      .getInject(id)
      .pipe(
        tap(() => {
          this.injectmStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.injectmStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.injectmStore.set([]);
  }

  add(catalogId: string, injectm: Injectm) {
    this.injectmStore.setLoading(true);
    this.injectService
      .createInject(catalogId, injectm)
      .pipe(
        tap(() => {
          this.injectmStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.setAsDates(s);
        this.injectmStore.add(s);
      });
  }

  update(injectm: Injectm) {
    this.injectmStore.setLoading(true);
    this.injectService
      .updateInject(injectm.id, injectm)
      .pipe(
        tap(() => {
          this.injectmStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.setAsDates(n);
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.injectService
      .deleteInject(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.injectmStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.injectmStore.update({ pageEvent: pageEvent });
  }

  updateStore(injectm: Injectm) {
    this.injectmStore.upsert(injectm.id, injectm);
  }

  deleteFromStore(id: string) {
    this.injectmStore.remove(id);
  }

  setAsDates(injectm: Injectm) {
    // set to a date object.
    injectm.dateCreated = new Date(injectm.dateCreated);
    injectm.dateModified = new Date(injectm.dateModified);
  }

}
