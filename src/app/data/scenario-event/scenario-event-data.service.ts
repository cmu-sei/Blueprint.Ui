// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { ScenarioEventStore } from './scenario-event.store';
import { ScenarioEventQuery } from './scenario-event.query';
import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  ScenarioEvent,
  ScenarioEventService,
  ItemStatus
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScenarioEventDataService {
  private _requestedScenarioEventId: string;
  private _requestedScenarioEventId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('scenarioEventId') || '')
  );
  readonly ScenarioEventList: Observable<ScenarioEvent[]>;
  readonly filterControl = new FormControl();
  private filterTerm: Observable<string>;
  private sortColumn: Observable<string>;
  private sortIsAscending: Observable<boolean>;
  private _pageEvent: PageEvent = { length: 0, pageIndex: 0, pageSize: 10 };
  readonly pageEvent = new BehaviorSubject<PageEvent>(this._pageEvent);
  private pageSize: Observable<number>;
  private pageIndex: Observable<number>;

  constructor(
    private scenarioEventStore: ScenarioEventStore,
    private scenarioEventQuery: ScenarioEventQuery,
    private scenarioEventService: ScenarioEventService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.filterTerm = activatedRoute.queryParamMap.pipe(
      map((params) => params.get('scenarioEventmask') || '')
    );
    this.filterControl.valueChanges.subscribe((term) => {
      this.router.navigate([], {
        queryParams: { scenarioEventmask: term },
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
    this.ScenarioEventList = combineLatest([
      this.scenarioEventQuery.selectAll(),
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
            ? (items as ScenarioEvent[])
                .sort((a: ScenarioEvent, b: ScenarioEvent) =>
                  this.sortScenarioEvents(a, b, sortColumn, sortIsAscending)
                )
                .filter(
                  (scenarioEvent) =>
                    scenarioEvent.id
                      .toLowerCase()
                      .includes(filterTerm.toLowerCase()
                  )
                )
            : []
      )
    );
  }

  private sortScenarioEvents(
    a: ScenarioEvent,
    b: ScenarioEvent,
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

  load() {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .getScenarioEvents()
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (scenarioEvents) => {
          this.scenarioEventStore.set(scenarioEvents);
        },
        (error) => {
          this.scenarioEventStore.set([]);
        }
      );
  }

  loadByMsel(mselId: string) {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .getScenarioEvents(mselId)
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe(
        (scenarioEvents) => {
          this.scenarioEventStore.set(scenarioEvents);
        },
        (error) => {
          this.scenarioEventStore.set([]);
        }
      );
  }

  loadById(id: string) {
    this.scenarioEventStore.setLoading(true);
    return this.scenarioEventService
      .getScenarioEvent(id)
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.scenarioEventStore.upsert(s.id, { ...s });
      });
  }

  unload() {
    this.scenarioEventStore.set([]);
  }

  add(scenarioEvent: ScenarioEvent) {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .createScenarioEvent(scenarioEvent)
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((s) => {
        this.scenarioEventStore.add(s);
      });
  }

  updateScenarioEvent(scenarioEvent: ScenarioEvent) {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .updateScenarioEvent(scenarioEvent.id, scenarioEvent)
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((n) => {
        this.updateStore(n);
      });
  }

  delete(id: string) {
    this.scenarioEventService
      .deleteScenarioEvent(id)
      .pipe(take(1))
      .subscribe((r) => {
        this.deleteFromStore(id);
      });
  }

  setPageEvent(pageEvent: PageEvent) {
    this.scenarioEventStore.update({ pageEvent: pageEvent });
  }

  updateStore(scenarioEvent: ScenarioEvent) {
    this.scenarioEventStore.upsert(scenarioEvent.id, scenarioEvent);
  }

  deleteFromStore(id: string) {
    this.scenarioEventStore.remove(id);
  }
}
