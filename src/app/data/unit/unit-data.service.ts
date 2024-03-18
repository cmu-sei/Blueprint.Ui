/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { UnitStore } from './unit.store';
import { UnitQuery } from './unit.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Unit,
  UnitService
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UnitDataService {
  // private _requestedUnitId: string;
  // private _requestedUnitId$ = this.activatedRoute.queryParamMap.pipe(
  //   map((params) => params.get('unitId') || '')
  // );
  readonly unitList: Observable<Unit[]>;
  // readonly selected: Observable<Unit>;
  readonly filterControl = new UntypedFormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private unitStore: UnitStore,
    private unitQuery: UnitQuery,
    private unitService: UnitService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('filter') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { filter: term },
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
    this.unitList = combineLatest([
      this.unitQuery.selectAll(),
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
            ? (items as Unit[])
              .sort((a: Unit, b: Unit) =>
                this.sortUnits(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (unit) =>
                  ('' + unit.name)
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()) ||
                    ('' + unit.shortName)
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())  ||
                    unit.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
    // this.selected = combineLatest([
    //   this.unitList,
    //   this._requestedUnitId$,
    // ]).pipe(
    //   map(([unitList, requestedUnitId]) => {
    //     let selectedUnit: Unit = null;
    //     if (unitList && unitList.length > 0) {
    //       if (requestedUnitId) {
    //         selectedUnit = unitList.find((unit) => unit.id === requestedUnitId);
    //         if (selectedUnit && selectedUnit.id !== this._requestedUnitId) {
    //           this.unitStore.setActive(requestedUnitId);
    //           this._requestedUnitId = requestedUnitId;
    //         }
    //       } else {
    //         selectedUnit = unitList[0];
    //         this.setActive(selectedUnit.id);
    //       }
    //     } else {
    //       this._requestedUnitId = '';
    //       this.unitStore.setActive('');
    //       this.unitStore.update({ unitList: [] });
    //     }
    //     return selectedUnit;
    //   })
    // );
  }

  load() {
    this.unitStore.setLoading(true);
    this.unitService
      .getUnits()
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (units) => {
          this.unitStore.set(units);
        },
        (error) => {
          this.unitStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.unitStore.setLoading(true);
    return this.unitService
      .getUnit(id)
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.unitStore.upsert(s.id, { ...s });
        this.setActive(id);
      });
  }

  loadByUserId(userId: string) {
    this.unitStore.setLoading(true);
    this.unitService
      .getUnitsByUser(userId)
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (units) => {
          this.unitStore.set(units);
        },
        (error) => {
          this.unitStore.set([]);
        }
      );
  }

  loadMine() {
    this.unitStore.setLoading(true);
    this.unitService
      .getMyUnits()
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (units) => {
          this.unitStore.set(units);
        },
        (error) => {
          this.unitStore.set([]);
        }
      );
  }

  unload() {
    this.unitStore.set([]);
    this.setActive('');
  }

  add(unit: Unit) {
    this.unitStore.setLoading(true);
    this.unitService
      .createUnit(unit)
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.unitStore.add(s);
        this.setActive(s.id);
      });
  }

  updateUnit(unit: Unit) {
    this.unitStore.setLoading(true);
    this.unitService
      .updateUnit(unit.id, unit)
      .pipe(
        tap(() => {
          this.unitStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.unitService
      .deleteUnit(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
        this.setActive('');
      });
  }

  setActive(id: string) {
    this.unitStore.setActive(id);
    // this.router.navigate([], {
    //   queryParams: { unitId: id },
    //   queryParamsHandling: 'merge',
    // });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.unitStore.update({ pageEvent: pageEvent });
  }

  updateStore(unit: Unit) {
    this.unitStore.upsert(unit.id, unit);
  }

  deleteFromStore(id: string) {
    this.unitStore.remove(id);
  }

  private sortUnits(
    a: Unit,
    b: Unit,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'name':
        return (
          (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      case 'shortName':
        return (
          (a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }
}
