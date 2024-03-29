/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ScenarioEventStore } from './scenario-event.store';
import { ScenarioEventQuery } from './scenario-event.query';
import { Injectable } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  DataValue,
  Move,
  ScenarioEvent,
  ScenarioEventService,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

export interface DataValuePlus extends DataValue {
  valueArray: string[];
}

export interface ScenarioEventPlus extends ScenarioEvent {
  plusDataValues: DataValuePlus[];
}

@Injectable({
  providedIn: 'root',
})
export class ScenarioEventDataService {
  readonly ScenarioEventList: Observable<ScenarioEvent[]>;
  readonly filterControl = new UntypedFormControl();  private _requestedScenarioEventId: string;
  private _requestedScenarioEventId$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get('scenarioEventId') || '')
  );

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

  loadByMsel(mselId: string) {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .getScenarioEventsByMsel(mselId)
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
      .subscribe((se) => {
        this.scenarioEventStore.upsert(se.id, se);
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
      .subscribe((se) => {
        this.scenarioEventStore.upsert(se.id, se);
      });
  }

  delete(id: string) {
    this.scenarioEventService
      .deleteScenarioEvent(id)
      .pipe(take(1))
      .subscribe(() => {});
  }

  batchDelete(idList: string[]) {
    this.scenarioEventService
      .batchDeleteScenarioEvent(idList)
      .pipe(take(1))
      .subscribe(() => {});
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

  getMoveAndGroupNumbers(rawScenarioEvents: ScenarioEvent[], rawMoves: Move[]): Record<string, number[]>[] {
    const scenarioEvents = rawScenarioEvents.sort((a, b) => +a.deltaSeconds < +b.deltaSeconds ? -1 : 1);
    const moveAndGroupNumbers: Record<string, number[]>[] = [];
    const moves = rawMoves.sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);
    let m = 0;
    let group = 0;
    let deltaSeconds = scenarioEvents.length > 0 ? scenarioEvents[0].deltaSeconds : 0;
    // loop through the chronological scenario events
    for (let s = 0; s < scenarioEvents.length; s++) {

      // if not on the last move, check this scenario event time to determine if it is in the current move
      if (moves.length === 0 || m === +moves.length - 1 || +scenarioEvents[s].deltaSeconds < +moves[m + 1].deltaSeconds) {
        if (scenarioEvents[s].deltaSeconds !== deltaSeconds) {
          group++;
        }
      } else {
        // the move must be incremented
        while (m < +moves.length - 1 && +scenarioEvents[s].deltaSeconds >= +moves[m + 1].deltaSeconds) {
          m++;  // increment the move
        }
        group = 0;  // start with group 0 for this new move
      }
      const moveNumber = moves.length > m ? moves[m].moveNumber : 0;
      deltaSeconds = scenarioEvents[s].deltaSeconds;
      moveAndGroupNumbers[scenarioEvents[s].id] = [moveNumber, group];
    }

    return moveAndGroupNumbers;
  }

}
