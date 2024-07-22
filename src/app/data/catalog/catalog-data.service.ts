// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CatalogStore } from './catalog.store';
import { CatalogQuery } from './catalog.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Catalog,
  CatalogService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CatalogDataService {
  private _requestedCatalogId: string;
  private _requestedCatalogId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('catalogId') || '')
  );
  readonly CatalogList: Observable<Catalog[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private catalogStore: CatalogStore,
    private catalogQuery: CatalogQuery,
    private catalogService: CatalogService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('catalogmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { catalogmask: term },
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
    this.CatalogList = combineLatest([
      this.catalogQuery.selectAll(),
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
            ? (items as Catalog[]).filter((catalog) =>
                catalog.id.toLowerCase().includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  load() {
    this.catalogStore.setLoading(true);
    this.catalogService
      .getCatalogs()
      .pipe(
        tap(() => {
          this.catalogStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.catalogStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadMine() {
    this.catalogStore.setLoading(true);
    this.catalogService
      .getMyCatalogs()
      .pipe(
        tap(() => {
          this.catalogStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.catalogStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadById(id: string) {
    this.catalogStore.setLoading(true);
    return this.catalogService
      .getCatalog(id)
      .pipe(
        tap(() => {
          this.catalogStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.catalogStore.set([]);
  }

  add(catalog: Catalog) {
    this.catalogStore.setLoading(true);
    this.catalogService
      .createCatalog(catalog)
      .pipe(
        tap(() => {
          this.catalogStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogStore.add(s);
      });
  }

  update(catalog: Catalog) {
    this.catalogStore.setLoading(true);
    this.catalogService
      .updateCatalog(catalog.id, catalog)
      .pipe(
        tap(() => {
          this.catalogStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.catalogService
      .deleteCatalog(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.catalogStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.catalogStore.update({ pageEvent: pageEvent });
  }

  updateStore(catalog: Catalog) {
    this.catalogStore.upsert(catalog.id, catalog);
  }

  deleteFromStore(id: string) {
    this.catalogStore.remove(id);
  }
}
