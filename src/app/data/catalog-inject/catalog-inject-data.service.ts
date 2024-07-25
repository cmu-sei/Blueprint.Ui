// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CatalogInjectStore } from './catalog-inject.store';
import { CatalogInjectQuery } from './catalog-inject.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CatalogInject,
  CatalogInjectService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { CatalogDataService } from '../catalog/catalog-data.service';

@Injectable({
  providedIn: 'root',
})
export class CatalogInjectDataService {
  private _requestedCatalogInjectId: string;
  private _requestedCatalogInjectId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('catalogInjectId') || '')
  );
  readonly CatalogInjectList: Observable<CatalogInject[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private catalogInjectStore: CatalogInjectStore,
    private catalogInjectQuery: CatalogInjectQuery,
    private catalogInjectService: CatalogInjectService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private catalogDataService: CatalogDataService
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('catalogInjectmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { catalogInjectmask: term },
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
    this.CatalogInjectList = combineLatest([
      this.catalogInjectQuery.selectAll(),
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
            ? (items as CatalogInject[]).filter((catalogInject) =>
                catalogInject.id
                  .toLowerCase()
                  .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  loadByCatalog(catalogId: string) {
    this.catalogInjectStore.setLoading(true);
    this.catalogInjectService
      .getCatalogInjects(catalogId)
      .pipe(
        tap(() => {
          this.catalogInjectStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (catalogInjects) => {
          this.catalogInjectStore.set(catalogInjects);
        },
        (error) => {
          this.catalogInjectStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.catalogInjectStore.setLoading(true);
    return this.catalogInjectService
      .getCatalogInject(id)
      .pipe(
        tap(() => {
          this.catalogInjectStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogInjectStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.catalogInjectStore.set([]);
  }

  add(catalogInject: CatalogInject) {
    this.catalogInjectStore.setLoading(true);
    this.catalogInjectService
      .createCatalogInject(catalogInject)
      .pipe(
        tap(() => {
          this.catalogInjectStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogInjectStore.add(s);
      });
  }

  delete(id: string) {
    this.catalogInjectService
      .deleteCatalogInject(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(r);
      });
  }

  deleteByIds(catalogId: string, injectId: string) {
    this.catalogInjectService
      .deleteCatalogInjectByIds(catalogId, injectId)
      .subscribe((r) => {
        this.deleteFromStore(r);
      });
  }

  setActive(id: string) {
    this.catalogInjectStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.catalogInjectStore.update({ pageEvent: pageEvent });
  }

  updateStore(catalogInject: CatalogInject) {
    this.catalogInjectStore.upsert(catalogInject.id, catalogInject);
  }

  deleteFromStore(id: string) {
    this.catalogInjectStore.remove(id);
  }
}
