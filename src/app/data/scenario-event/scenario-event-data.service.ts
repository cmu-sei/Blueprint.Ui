/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ScenarioEventStore } from './scenario-event.store';
import { ScenarioEventQuery } from './scenario-event.query';
import { Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { UntypedFormControl } from '@angular/forms';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Card,
  DataField,
  DataFieldType,
  DataValue,
  Move,
  ScenarioEvent,
  ScenarioEventService,
  User,
} from 'src/app/generated/blueprint.api';
import { map, take, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';

export interface DataValuePlus extends DataValue {
  fieldType: DataFieldType;
  sortAndFilterValue: (string | number);
  valueArray: string[];
}

export interface ScenarioEventPlus extends ScenarioEvent {
  plusDataValues: Map<string, DataValuePlus>;
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
  readonly baseSort: Sort[] = [{ active: 'deltaSeconds', direction: 'asc' }, { active: 'groupOrder', direction: 'asc' }];

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

  private sortAndFilterValueFromField(value: DataValue, fieldType: DataFieldType,
    cardMap: Map<string, string>, userMap: Map<string, string>): (string | number) {
    switch (fieldType) {
      case DataFieldType.Card:
        const cardName = cardMap.get(value.value);
        return cardName ? cardName : '';
      case DataFieldType.User:
        const userName = userMap.get(value.value);
        return userName ? userName : '';
      case DataFieldType.Html:
        return '';
      case DataFieldType.Double:
      case DataFieldType.Integer:
      case DataFieldType.Move:
        return value.value ? +value.value : Number.NEGATIVE_INFINITY;
      default:
        return value.value ? value.value : '';
    }
  }

  private indexFieldsAndValues(datafields: DataField[], dataValues: DataValue[], cards: Card[],
    users: User[]): [Map<string, DataField>, Map<string, Map<string, DataValuePlus>>] {
    const fieldMap = new Map<string, DataField>();
    const valueMap = new Map<string, Map<string, DataValuePlus>>();
    const cardMap = new Map<string, string>();
    const userMap = new Map<string, string>();
    if (cards) {
      for (const card of cards) {
        cardMap.set(card.id, card.name);
      }
    }
    if (users) {
      for (const user of users) {
        userMap.set(user.id, user.name);
      }
    }
    for (const field of datafields) {
      fieldMap.set(field.id, field);
    }
    for (const value of dataValues) {
      let eventProps = valueMap.get(value.scenarioEventId);
      if (!(eventProps)) {
        eventProps = new Map<string, DataValuePlus>();
        valueMap.set(value.scenarioEventId, eventProps);
      }
      const fieldType = fieldMap.get(value.dataFieldId);
      if (fieldType) {
        const sortAndFilterVal = this.sortAndFilterValueFromField(value, fieldType.dataType, cardMap, userMap);
        const dataValue: DataValuePlus =
        {...value, sortAndFilterValue: sortAndFilterVal,
          valueArray: value.value ? value.value.split(', ') : [], fieldType: fieldType.dataType};
        eventProps.set(fieldType.name, dataValue);
      }
    }

    return [fieldMap, valueMap];
  }

  private dataValuesIncludesFilter(valueMap: Map<string, DataValuePlus>, filterString: string) {
    for (const val of valueMap.values()) {
      if (val.value?.toLowerCase().includes(filterString)) {
        return true;
      }
    }
    return false;
  }

  private cloneAndFilterScenarioEvents(scenarioEvents: ScenarioEvent[], datafields: DataField[], dataValues: DataValue[],
    cards: Card[], users: User[], filterString: string, showHidden: boolean): ScenarioEventPlus[] {
    const clonedList: ScenarioEventPlus[] = [];
    if (scenarioEvents && scenarioEvents.length > 0 && dataValues.length > 0) {
      // index the fields and values for faster access
      const [fieldMap, valueMap] = this.indexFieldsAndValues(datafields, dataValues, cards, users);

      scenarioEvents.forEach(scenarioEvent => {
        if (!scenarioEvent.isHidden || showHidden) {
          const plusDataValues = valueMap.get(scenarioEvent.id);
          if (plusDataValues) {
            if (!filterString || this.dataValuesIncludesFilter(plusDataValues, filterString)) {
              const newScenarioEvent = { ...scenarioEvent, plusDataValues: plusDataValues};
              clonedList.push(newScenarioEvent);
            }
          }
        }
      });
    }
    return clonedList;
  }

  private getSortAndFilterValueFromEvent(scenarioEvent: ScenarioEventPlus, fieldName: string): (string | number) {
    if ('deltaSeconds' === fieldName) {
      return +scenarioEvent.deltaSeconds;
    } else if ('groupOrder' === fieldName) {
      return +scenarioEvent.groupOrder;
    } else {
      const val = scenarioEvent.plusDataValues.get(fieldName);
      if (val) {
        return val.sortAndFilterValue;
      }
      return '';
    }
  }

  private getNumOrDefault(value: (string | number)): number {
    if (typeof value !== undefined && typeof value !== null) {
      return +value;
    }
    return Number.NEGATIVE_INFINITY;
  }

  private sortScenarioEventImpl(a: ScenarioEventPlus, b: ScenarioEventPlus, sorts: Sort[]): number {
    let sortVal = 0;
    for (const sort of sorts) {
      const dir = sort.direction === 'desc' ? -1 : 1;
      const sortValA = this.getSortAndFilterValueFromEvent(a, sort.active);
      const sortValB = this.getSortAndFilterValueFromEvent(b, sort.active);
      if (typeof sortValA === 'number' || typeof sortValB === 'number') {
        const numValA = this.getNumOrDefault(sortValA);
        const numValB = this.getNumOrDefault(sortValB);
        let numSortVal = 0;
        if (+numValA < +numValB) {
          numSortVal = -1;
        } else if (+numValA > +numValB) {
          numSortVal = 1;
        }
        sortVal = numSortVal ? numSortVal * dir : numSortVal;
      } else {
        const strSortVal = Intl.Collator().compare(
          sortValA ? sortValA.trim().toLowerCase() : '',
          sortValB ? sortValB.trim().toLowerCase() : '');
        sortVal = strSortVal ? strSortVal * dir : strSortVal;
      }
      if (sortVal) {
        return sortVal;
      }
    }
    return sortVal;
  }

  private sortExternalScenarioEvents(scenarioEvents: ScenarioEventPlus[], sort: Sort) {
    const sorts: Sort[] = [];
    if (sort && sort.active && sort.direction) {
      sorts.push(sort);
    }
    sorts.push(...this.baseSort);
    scenarioEvents.sort((a: ScenarioEventPlus, b: ScenarioEventPlus) => this.sortScenarioEventImpl(a, b, sorts));
  }

  sortAndFilterScenarioEvents(rawScenarioEvents: ScenarioEvent[], datafields: DataField[], dataValues: DataValue[],
    cards: Card[], users: User[], sort: Sort, filterString: string, showHidden: boolean = false): ScenarioEventPlus[] {
    const clonedList = this.cloneAndFilterScenarioEvents(rawScenarioEvents, datafields, dataValues, cards, users, filterString, showHidden);
    this.sortExternalScenarioEvents(clonedList, sort);
    return clonedList;
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
