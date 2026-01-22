// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { CiteDutyStore } from './cite-duty.store';
import { CiteDutyQuery } from './cite-duty.query';
import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CiteDuty,
  CiteDutyService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CiteDutyDataService {
  private _requestedCiteDutyId: string;
  private _requestedCiteDutyId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('citeDutyId') || '')
  );
  readonly CiteDutyList: Observable<CiteDuty[]>;
  readonly filterControl = new FormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private citeDutyStore: CiteDutyStore,
    private citeDutyQuery: CiteDutyQuery,
    private citeDutyService: CiteDutyService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('citeDutymask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { citeDutymask: term },
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
    this.CiteDutyList = combineLatest([
      this.citeDutyQuery.selectAll(),
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
            ? (items as CiteDuty[])
              .sort((a: CiteDuty, b: CiteDuty) =>
                this.sortCiteDuties(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (citeDuty) =>
                  ('' + citeDuty.name)
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()) ||
                    citeDuty.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
              )
            : []
      )
    );
  }

  private sortCiteDuties(
    a: CiteDuty,
    b: CiteDuty,
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
    this.citeDutyStore.setLoading(true);
    this.citeDutyService
      .getCiteDutyTemplates()
      .pipe(
        tap(() => {
          this.citeDutyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.citeDutyStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadByMsel(mselId: string) {
    this.citeDutyStore.setLoading(true);
    this.citeDutyService
      .getDutiesByMsel(mselId)
      .pipe(
        tap(() => {
          this.citeDutyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (citeDuties) => {
          this.citeDutyStore.set(citeDuties);
        },
        (error) => {
          this.citeDutyStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.citeDutyStore.setLoading(true);
    return this.citeDutyService
      .getCiteDuty(id)
      .pipe(
        tap(() => {
          this.citeDutyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeDutyStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.citeDutyStore.set([]);
  }

  add(citeDuty: CiteDuty) {
    this.citeDutyStore.setLoading(true);
    this.citeDutyService
      .createCiteDuty(citeDuty)
      .pipe(
        tap(() => {
          this.citeDutyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.citeDutyStore.add(s);
      });
  }

  updateCiteDuty(citeDuty: CiteDuty) {
    this.citeDutyStore.setLoading(true);
    this.citeDutyService
      .updateCiteDuty(citeDuty.id, citeDuty)
      .pipe(
        tap(() => {
          this.citeDutyStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.citeDutyService
      .deleteCiteDuty(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.citeDutyStore.update({ pageEvent: pageEvent });
  }

  updateStore(citeDuty: CiteDuty) {
    this.citeDutyStore.upsert(citeDuty.id, citeDuty);
  }

  deleteFromStore(id: string) {
    this.citeDutyStore.remove(id);
  }
}
