// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MselUnitStore } from './msel-unit.store';
import { MselUnitQuery } from './msel-unit.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  MselUnit,
  MselUnitService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselUnitDataService {
  private _requestedMselUnitId: string;
  private _requestedMselUnitId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('mselUnitId') || '')
  );
  readonly MselUnitList: Observable<MselUnit[]>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private mselUnitStore: MselUnitStore,
    private mselUnitQuery: MselUnitQuery,
    private mselUnitService: MselUnitService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('mselUnitmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { mselUnitmask: term },
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
    this.MselUnitList = combineLatest([
      this.mselUnitQuery.selectAll(),
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
            ? (items as MselUnit[])
              .filter(
                (mselUnit) =>
                  mselUnit.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase())                )
            : []
      )
    );
  }

  loadByMsel(mselId: string) {
    this.mselUnitStore.setLoading(true);
    this.mselUnitService
      .getMselUnits(mselId)
      .pipe(
        tap(() => {
          this.mselUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (mselUnits) => {
          this.mselUnitStore.set(mselUnits);
        },
        (error) => {
          this.mselUnitStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.mselUnitStore.setLoading(true);
    return this.mselUnitService
      .getMselUnit(id)
      .pipe(
        tap(() => {
          this.mselUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselUnitStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.mselUnitStore.set([]);
  }

  add(mselUnit: MselUnit) {
    this.mselUnitStore.setLoading(true);
    this.mselUnitService
      .createMselUnit(mselUnit)
      .pipe(
        tap(() => {
          this.mselUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselUnitStore.add(s);
      });
  }

  updateMselUnit(mselUnit: MselUnit) {
    this.mselUnitStore.setLoading(true);
    this.mselUnitService
      .updateMselUnit(mselUnit.id, mselUnit)
      .pipe(
        tap(() => {
          this.mselUnitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.mselUnitService
      .deleteMselUnit(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setActive(id: string) {
    this.mselUnitStore.setActive(id);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.mselUnitStore.update({ pageEvent: pageEvent });
  }

  updateStore(mselUnit: MselUnit) {
    this.mselUnitStore.upsert(mselUnit.id, mselUnit);
  }

  deleteFromStore(id: string) {
    this.mselUnitStore.remove(id);
  }

}
