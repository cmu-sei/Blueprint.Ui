// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { MselStore } from './msel.store';
import { MselQuery } from './msel.query';
import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  DataValue,
  Msel,
  MselService,
  ScenarioEvent
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MselDataService {
  private _requestedMselId: string;
  private _requestedMselId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('mselId') || '')
  );
  readonly MselList: Observable<Msel[]>;
  readonly filterControl = new FormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private mselStore: MselStore,
    private mselQuery: MselQuery,
    private mselService: MselService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('mselmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { mselmask: term },
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
    this.MselList = combineLatest([
      this.mselQuery.selectAll(),
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
            ? (items as Msel[])
                .sort((a: Msel, b: Msel) =>
                  this.sortMsels(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (msel) =>
                    ('' + msel.description)
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()) ||
                    msel.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase())
                )
            : []
      )
    );
  }

  private sortMsels(
    a: Msel,
    b: Msel,
    column: string,
    isAsc: boolean
  ) {
    switch (column) {
      case 'description':
        return (
          (a.description.toLowerCase() < b.description.toLowerCase() ? -1 : 1) *
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

  load() {
    this.mselStore.setLoading(true);
    this.mselService
      .getMsels()
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (msels) => {
          this.mselStore.set(msels);
        },
        (error) => {
          this.mselStore.set([]);
          this.mselStore.setLoading(false);
        }
      );
  }

  loadMine() {
    this.mselStore.setLoading(true);
    this.mselService
      .getMyMsels()
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (msels) => {
          this.mselStore.set(msels);
        },
        (error) => {
          this.mselStore.set([]);
          this.mselStore.setLoading(false);
        }
      );
  }

  loadById(id: string) {
    this.mselStore.setLoading(true);
    return this.mselService
      .getMsel(id)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselStore.upsert(s.id, { ...s });
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  unload() {
    this.mselStore.set([]);
  }

  add(msel: Msel) {
    this.mselStore.setLoading(true);
    this.mselService
      .createMsel(msel)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.mselStore.add(s);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  updateMsel(msel: Msel) {
    this.mselStore.setLoading(true);
    this.mselService
      .updateMsel(msel.id, msel)
      .pipe(
        tap(() => {
          this.mselStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      },
      (error) => {
        this.mselStore.setLoading(false);
      });
  }

  delete(id: string) {
    this.mselService
      .deleteMsel(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  downloadXlsx(id: string) {
    return this.mselService.download(id);
  }

  uploadXlsx(mselId: string, teamId: string, file: File, observe: any, reportProgress: boolean) {
    if (mselId) {
      return this.mselService.replaceWithXlsxFile(mselId, '', '', teamId, file, observe, reportProgress);
    }
    return this.mselService.uploadXlsxFiles('', '', teamId, file, observe, reportProgress);
  }

  setPageEvent(pageEvent: PageEvent) {
    this.mselStore.update({ pageEvent: pageEvent });
  }

  updateStore(msel: Msel) {
    this.mselStore.upsert(msel.id, msel);
  }

  deleteFromStore(id: string) {
    this.mselStore.remove(id);
  }

  setActive(id: string) {
    this.mselStore.setActive(id);
  }

  // MSEL children update section
  updateDataValue(returnedDataValue: DataValue) {
    const msel = this.mselQuery.getByScenarioEventId(returnedDataValue.scenarioEventId);
    const updatedMsel: Msel = {... msel};
    updatedMsel.scenarioEvents = [];
    msel.scenarioEvents.forEach(se => {
      if (se.dataValues && se.dataValues.some(dv => dv.id === returnedDataValue.id)) {
        const updatedScenarioEvent: ScenarioEvent = {... se};
        updatedScenarioEvent.dataValues = [];
        se.dataValues.forEach(dv => {
          if (dv.id === returnedDataValue.id) {
            const updateDataValue: DataValue = {... dv};
            updateDataValue.value = returnedDataValue.value;
            updatedScenarioEvent.dataValues.push(updateDataValue);
          } else {
            updatedScenarioEvent.dataValues.push(dv);
          }
        });
        updatedMsel.scenarioEvents.push(updatedScenarioEvent)
      } else {
        updatedMsel.scenarioEvents.push(se)
      }
    });
    this.mselStore.upsert(updatedMsel.id, updatedMsel);
  }

}
