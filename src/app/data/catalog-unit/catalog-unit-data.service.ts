// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CatalogUnitStore } from './catalog-unit.store';
import { CatalogUnitQuery } from './catalog-unit.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CatalogUnit,
  CatalogUnitService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CatalogUnitDataService {
  private _requestedCatalogUnitId: string;
  private _requestedCatalogUnitId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('catalogUnitId') || '')
  );
  readonly CatalogUnitList: Observable<CatalogUnit[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private catalogUnitStore: CatalogUnitStore,
    private catalogUnitQuery: CatalogUnitQuery,
    private catalogUnitService: CatalogUnitService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('catalogUnitmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { catalogUnitmask: term },
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
    this.CatalogUnitList = combineLatest([
      this.catalogUnitQuery.selectAll(),
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
            ? (items as CatalogUnit[])
              .filter(
                (catalogUnit) =>
                  catalogUnit.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()))
            : []
      )
    );
  }

  loadByCatalog(catalogId: string) {
    this.catalogUnitStore.setLoading(true);
    this.catalogUnitService
      .getCatalogUnits(catalogId)
      .pipe(
        tap(() => {
          this.catalogUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (catalogUnits) => {
          this.catalogUnitStore.set(catalogUnits);
        },
        (error) => {
          this.catalogUnitStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.catalogUnitStore.setLoading(true);
    return this.catalogUnitService
      .getCatalogUnit(id)
      .pipe(
        tap(() => {
          this.catalogUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogUnitStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.catalogUnitStore.set([]);
  }

  add(catalogUnit: CatalogUnit) {
    this.catalogUnitStore.setLoading(true);
    this.catalogUnitService
      .createCatalogUnit(catalogUnit)
      .pipe(
        tap(() => {
          this.catalogUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.catalogUnitStore.add(s);
      });
  }

  updateCatalogUnit(catalogUnit: CatalogUnit) {
    this.catalogUnitStore.setLoading(true);
    this.catalogUnitService
      .updateCatalogUnit(catalogUnit.id, catalogUnit)
      .pipe(
        tap(() => {
          this.catalogUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.catalogUnitService
      .deleteCatalogUnit(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.catalogUnitStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.catalogUnitStore.update({ pageEvent: pageEvent });
  }

  updateStore(catalogUnit: CatalogUnit) {
    this.catalogUnitStore.upsert(catalogUnit.id, catalogUnit);
  }

  deleteFromStore(id: string) {
    this.catalogUnitStore.remove(id);
  }

}
