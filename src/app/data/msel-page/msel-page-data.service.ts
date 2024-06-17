// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselPageStore } from './msel-page.store';
import { MselPageQuery } from './msel-page.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  MselPage,
  MselPageService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselPageDataService {
  private _requestedMselPageId: string;
  private _requestedMselPageId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('mselPageId') || '')
  );
  readonly MselPageList: Observable<MselPage[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private mselPageStore: MselPageStore,
    private mselPageQuery: MselPageQuery,
    private mselPageService: MselPageService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('mselPagemask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { mselPagemask: term },
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
    this.MselPageList = combineLatest([
      this.mselPageQuery.selectAll(),
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
            ? (items as MselPage[])
              .filter(
                (mselPage) =>
                  mselPage.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  loadByMsel(mselId: string) {
    this.mselPageStore.setLoading(true);
    this.mselPageService
      .getMselPages(mselId)
      .pipe(
        tap(() => {
          this.mselPageStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (mselPages) => {
          mselPages.forEach(a => {
          });
          this.mselPageStore.set(mselPages);
        },
        (error) => {
          this.mselPageStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.mselPageStore.setLoading(true);
    return this.mselPageService
      .getMselPage(id)
      .pipe(
        tap(() => {
          this.mselPageStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselPageStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.mselPageStore.set([]);
  }

  add(mselPage: MselPage) {
    this.mselPageStore.setLoading(true);
    this.mselPageService
      .createMselPage(mselPage)
      .pipe(
        tap(() => {
          this.mselPageStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselPageStore.add(s);
      });
  }

  update(mselPage: MselPage) {
    this.mselPageStore.setLoading(true);
    this.mselPageService
      .updateMselPage(mselPage.id, mselPage)
      .pipe(
        tap(() => {
          this.mselPageStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.mselPageService
      .deleteMselPage(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.mselPageStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.mselPageStore.update({ pageEvent: pageEvent });
  }

  updateStore(mselPage: MselPage) {
    this.mselPageStore.upsert(mselPage.id, mselPage);
  }

  deleteFromStore(id: string) {
    this.mselPageStore.remove(id);
  }

}
