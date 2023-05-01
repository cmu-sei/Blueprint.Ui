/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { DataOptionStore } from './data-option.store';
import { DataOptionQuery } from './data-option.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  DataOption,
  DataOptionService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataOptionDataService {
  readonly DataOptionList: Observable<DataOption[]>;
  readonly filterControl = new UntypedFormControl();
  private _requestedDataOptionId: string;
  private _requestedDataOptionId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('dataOptionId') || '')
  );
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private dataOptionStore: DataOptionStore,
    private dataOptionQuery: DataOptionQuery,
    private dataOptionService: DataOptionService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('dataOptionmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { dataOptionmask: term },
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
    this.DataOptionList = combineLatest([
      this.dataOptionQuery.selectAll(),
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
            ? (items as DataOption[])
              .sort((a: DataOption, b: DataOption) =>
                this.sortDataOptions(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (dataOption) =>
                  dataOption.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()
                    )
              )
            : []
      )
    );
  }

  loadByMsel(mselId: string) {
    this.dataOptionStore.setLoading(true);
    this.dataOptionService
      .getByMsel(mselId)
      .pipe(
        tap(() => {
          this.dataOptionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (dataOptions) => {
          this.dataOptionStore.set(dataOptions);
        },
        (error) => {
          this.dataOptionStore.set([]);
        }
      );
  }

  loadByDataField(dataFieldId: string) {
    this.dataOptionStore.setLoading(true);
    this.dataOptionService
      .getByDataField(dataFieldId)
      .pipe(
        tap(() => {
          this.dataOptionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (dataOptions) => {
          this.dataOptionStore.upsertMany(dataOptions);
        },
        (error) => {
        }
      );
  }

  loadById(id: string) {
    this.dataOptionStore.setLoading(true);
    return this.dataOptionService
      .getDataOption(id)
      .pipe(
        tap(() => {
          this.dataOptionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.dataOptionStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.dataOptionStore.set([]);
  }

  add(dataOption: DataOption) {
    this.dataOptionStore.setLoading(true);
    this.dataOptionService
      .createDataOption(dataOption)
      .pipe(
        tap(() => {
          this.dataOptionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.dataOptionStore.add(s);
      });
  }

  updateDataOption(dataOption: DataOption) {
    this.dataOptionStore.setLoading(true);
    this.dataOptionService
      .updateDataOption(dataOption.id, dataOption)
      .pipe(
        tap(() => {
          this.dataOptionStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.dataOptionService
      .deleteDataOption(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.dataOptionStore.update({ pageEvent: pageEvent });
  }

  updateStore(dataOption: DataOption) {
    this.dataOptionStore.upsert(dataOption.id, dataOption);
  }

  deleteFromStore(id: string) {
    this.dataOptionStore.remove(id);
  }

  private sortDataOptions(
    a: DataOption,
    b: DataOption,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'dateCreated':
        return (
          (a.dateCreated.valueOf() < b.dateCreated.valueOf() ? -1 : 1) *
          (isAsc ? 1 : -1)
        );
      default:
        return 0;
    }
  }
}
