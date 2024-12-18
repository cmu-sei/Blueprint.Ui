/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { DataFieldStore } from './data-field.store';
import { DataFieldTemplateStore } from './data-field-template.store';
import { DataFieldQuery } from './data-field.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  DataField,
  DataFieldService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataFieldDataService {
  readonly DataFieldList: Observable<DataField[]>;
  readonly filterControl = new UntypedFormControl();
  private _requestedDataFieldId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('dataFieldId') || '')
  );
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);  private _requestedDataFieldId: string;
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private dataFieldStore: DataFieldStore,
    private dataFieldTemplateStore: DataFieldTemplateStore,
    private dataFieldQuery: DataFieldQuery,
    private dataFieldService: DataFieldService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('dataFieldmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { dataFieldmask: term },
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
    this.DataFieldList = combineLatest([
      this.dataFieldQuery.selectAll(),
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
            ? (items as DataField[])
              .sort((a: DataField, b: DataField) =>
                this.sortDataFields(a, b, sortColumn, sortIsAscending)
              )
              .filter(
                (dataField) =>
                  dataField.id
                    .toLowerCase()
                    .includes(filterTerm.toLowerCase()
                    )
              )
            : []
      )
    );
  }

  loadTemplates() {
    this.dataFieldTemplateStore.setLoading(true);
    this.dataFieldService
      .getDataFieldTemplates()
      .pipe(
        tap(() => {
          this.dataFieldTemplateStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (templates) => {
          this.dataFieldTemplateStore.upsertMany(templates);
        },
        (error) => {}
      );
  }

  loadByMsel(mselId: string) {
    this.dataFieldStore.setLoading(true);
    this.dataFieldService
      .getDataFieldsByMsel(mselId)
      .pipe(
        tap(() => {
          this.dataFieldStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (dataFields) => {
          this.dataFieldStore.set(dataFields);
        },
        (error) => {
          this.dataFieldStore.set([]);
        }
      );
  }

  loadByInjectType(injectTypeId: string) {
    this.dataFieldStore.setLoading(true);
    this.dataFieldService
      .getDataFieldsByInjectType(injectTypeId)
      .pipe(
        tap(() => {
          this.dataFieldStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (dataFields) => {
          this.dataFieldStore.upsertMany(dataFields);
        }
      );
  }

  unload() {
    this.dataFieldStore.set([]);
  }

  add(dataField: DataField) {
    if (dataField.isTemplate) {
      this.dataFieldTemplateStore.setLoading(true);
      this.dataFieldService
        .createDataField(dataField)
        .pipe(
          tap(() => {
            this.dataFieldTemplateStore.setLoading(false);
          }),
          take(1)
        )
        .subscribe((df) => {
          this.dataFieldTemplateStore.upsert(df.id, df);
        });
    } else {
      this.dataFieldStore.setLoading(true);
      this.dataFieldService
        .createDataField(dataField)
        .pipe(
          tap(() => {
            this.dataFieldStore.setLoading(false);
          }),
          take(1)
        )
        .subscribe((df) => {
          this.dataFieldStore.upsert(df.id, df);
        });
    }
  }

  updateDataField(dataField: DataField) {
    if (dataField.isTemplate) {
      this.dataFieldTemplateStore.setLoading(true);
      this.dataFieldService
        .updateDataField(dataField.id, dataField)
        .pipe(
          tap(() => {
            this.dataFieldTemplateStore.setLoading(false);
          }),
          take(1)
        )
        .subscribe((df) => {
          this.dataFieldTemplateStore.upsert(df.id, df);
        });
    } else {
      this.dataFieldStore.setLoading(true);
      this.dataFieldService
        .updateDataField(dataField.id, dataField)
        .pipe(
          tap(() => {
            this.dataFieldStore.setLoading(false);
          }),
          take(1)
        )
        .subscribe((df) => {
          this.dataFieldStore.upsert(df.id, df);
        });
    }
  }

  delete(id: string) {
    this.dataFieldService
      .deleteDataField(id)
      .pipe(take(1))
      .subscribe((dfid) => {
        this.deleteFromStore(dfid);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.dataFieldStore.update({ pageEvent: pageEvent });
  }

  updateStore(dataField: DataField) {
    if (dataField.isTemplate) {
      this.dataFieldTemplateStore.upsert(dataField.id, dataField);
    } else {
      this.dataFieldStore.upsert(dataField.id, dataField);
    }
  }

  deleteFromStore(id: string) {
    this.dataFieldStore.remove(id);
    this.dataFieldTemplateStore.remove(id);
  }

  private sortDataFields(
    a: DataField,
    b: DataField,
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
