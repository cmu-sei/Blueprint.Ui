/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ScenarioEventStore } from './scenario-event.store';
import { Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import {
  Card,
  CreateFromInjectsForm,
  DataField,
  DataFieldType,
  DataValue,
  Move,
  ScenarioEvent,
  ScenarioEventService,
  User,
} from 'src/app/generated/blueprint.api';
import { take, tap } from 'rxjs/operators';


export type IntegrationTarget = 'Gallery' | 'Steamfitter' | 'Email' | 'Notification';
export const IntegrationTarget = {
    Gallery: 'Gallery' as IntegrationTarget,
    Steamfitter: 'Steamfitter' as IntegrationTarget,
    Email: 'Email' as IntegrationTarget,
    Notification: 'Notification' as IntegrationTarget
};

export interface DataValuePlus extends DataValue {
  fieldType: DataFieldType;
  sortAndFilterValue: string | number;
  valueArray: string[];
}

export class ScenarioEventViewIndexing {
  fieldMap = new Map<string, DataField>();
  valueMap = new Map<string, Map<string, DataValuePlus>>();
  cardMap = new Map<string, string>();
  userMap = new Map<string, string>();
  mselScenarioEvtIndex = new Map<string, number>();
}

export interface ScenarioEventView {
  get mselScenarioEvents(): ScenarioEvent[];
  set mselScenarioEvents(evts: ScenarioEvent[]);

  get filterString(): string;

  get showHiddenEvents(): boolean;

  get sort(): Sort;

  get displayedScenarioEvents(): ScenarioEvent[];
  set displayedScenarioEvents(evts: ScenarioEvent[]);

  get dataFields(): DataField[];

  get dataValues(): DataValue[];

  get cardList(): Card[];

  get userList(): User[];

  get viewIndex(): ScenarioEventViewIndexing;
  set viewIndex(index: ScenarioEventViewIndexing);
}

@Injectable({
  providedIn: 'root',
})
export class ScenarioEventDataService {
  constructor(
    private scenarioEventStore: ScenarioEventStore,
    private scenarioEventService: ScenarioEventService
  ) {}

  readonly baseSort: Sort[] = [
    { active: 'deltaSeconds', direction: 'asc' },
    { active: 'groupOrder', direction: 'asc' },
  ];
  readonly blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;

  sortableDataTypes = [
    DataFieldType.String,
    DataFieldType.Integer,
    DataFieldType.Double,
    DataFieldType.Boolean,
    DataFieldType.DateTime,
    DataFieldType.Organization,
    DataFieldType.Card,
    DataFieldType.Move,
    DataFieldType.SourceType,
    DataFieldType.Status,
    DataFieldType.Team,
    DataFieldType.TeamsMultiple,
    DataFieldType.Checkbox,
    DataFieldType.User,
    DataFieldType.Url,
    DataFieldType.IntegrationTarget,
  ];

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
      .subscribe((scenarioEvents) => {
        this.scenarioEventStore.upsertMany(scenarioEvents);
      });
  }

  addInjects(createFromInjectsForm: CreateFromInjectsForm) {
    this.scenarioEventStore.setLoading(true);
    this.scenarioEventService
      .createScenarioEventsFromInjects(createFromInjectsForm)
      .pipe(
        tap(() => {
          this.scenarioEventStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe((scenarioEvents) => {
        this.scenarioEventStore.upsertMany(scenarioEvents);
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
      .subscribe((scenarioEvents) => {
        this.scenarioEventStore.upsertMany(scenarioEvents);
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
      .batchDeleteScenarioEvents(idList)
      .pipe(take(1))
      .subscribe(() => {});
  }

  copyScenarioEventsToMsel(mselId: string, scenarioEventIds: string[]) {
    this.scenarioEventService
      .copyScenarioEventsToMsel(mselId, scenarioEventIds)
      .pipe(take(1))
      .subscribe((scenarioEvents) => {
        this.scenarioEventStore.upsertMany(scenarioEvents);
      });
  }

  updateStore(scenarioEvent: ScenarioEvent) {
    this.scenarioEventStore.upsert(scenarioEvent.id, scenarioEvent);
  }

  deleteFromStore(id: string) {
    this.scenarioEventStore.remove(id);
  }

  getDataValueFromView(
    view: ScenarioEventView,
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): DataValuePlus {
    return this.getValueFromEvent(view, scenarioEvent, dataFieldName);
  }

  getDisplayValueFromView(
    view: ScenarioEventView,
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): string {
    const value = this.getDataValueFromView(view, scenarioEvent, dataFieldName);
    switch (value.fieldType) {
      case DataFieldType.Card:
      case DataFieldType.User:
        return value.sortAndFilterValue.toString();
      case DataFieldType.DateTime:
        const dateValue = value.value ? value.value : '';
        const formattedValue = new Date(dateValue).toLocaleString();
        return formattedValue === 'Invalid Date' ? ' ' : formattedValue;
      default:
        return value.value ? value.value : '';
    }
  }

  updateScenarioEventViewCards(view: ScenarioEventView) {
    view.viewIndex.cardMap = this.indexCards(view.cardList);
  }

  updateScenarioEventViewUsers(view: ScenarioEventView) {
    view.viewIndex.userMap = this.indexUsers(view.userList);
  }

  updateScenarioEventViewDataFields(view: ScenarioEventView) {
    view.viewIndex.fieldMap = this.indexFields(view.dataFields);
  }

  updateScenarioEventViewDataValues(view: ScenarioEventView) {
    view.viewIndex.valueMap = this.indexValues(
      view.viewIndex.fieldMap,
      view.viewIndex.cardMap,
      view.viewIndex.userMap,
      view.dataValues
    );
  }

  refreshScenarioEventViewEvents(
    view: ScenarioEventView,
    scenarioEvents: ScenarioEvent[]
  ) {
    const editableList: ScenarioEvent[] = [];
    const evtIndex = new Map<string, number>();
    scenarioEvents.forEach((scenarioEvent, index) => {
      if (!scenarioEvent.isHidden || view.showHiddenEvents) {
        const newScenarioEvent = { ...scenarioEvent };
        editableList.push(newScenarioEvent);
        evtIndex.set(newScenarioEvent.id, index);
      }
    });
    view.mselScenarioEvents = editableList;
    view.viewIndex.mselScenarioEvtIndex = evtIndex;
  }

  updateScenarioEventViewDisplayedEvents(view: ScenarioEventView) {
    let clonedList = this.cloneAndFilterScenarioEvents(
      view.mselScenarioEvents,
      view.viewIndex.valueMap,
      view.filterString,
      view.showHiddenEvents
    );
    clonedList = this.sortScenarioEvents(
      clonedList,
      view.sort,
      view.viewIndex.valueMap
    );
    view.displayedScenarioEvents = clonedList;
  }

  getMoveAndGroupNumbers(
    sortedScenarioEvents: ScenarioEvent[],
    rawMoves: Move[]
  ): Record<string, number[]>[] {
    const moveAndGroupNumbers: Record<string, number[]>[] = [];
    const moves = rawMoves.sort((a, b) =>
      +a.moveNumber < +b.moveNumber ? -1 : 1
    );
    let m = 0;
    let group = 0;
    let deltaSeconds =
      sortedScenarioEvents.length > 0
        ? sortedScenarioEvents[0].deltaSeconds
        : 0;
    // loop through the chronological scenario events
    for (let s = 0; s < sortedScenarioEvents.length; s++) {
      // if not on the last move, check this scenario event time to determine if it is in the current move
      if (
        moves.length === 0 ||
        m === +moves.length - 1 ||
        +sortedScenarioEvents[s].deltaSeconds < +moves[m + 1].deltaSeconds
      ) {
        if (sortedScenarioEvents[s].deltaSeconds !== deltaSeconds) {
          group++;
        }
      } else {
        // the move must be incremented
        while (
          m < +moves.length - 1 &&
          +sortedScenarioEvents[s].deltaSeconds >= +moves[m + 1].deltaSeconds
        ) {
          m++; // increment the move
        }
        group = 0; // start with group 0 for this new move
      }
      const moveNumber = moves.length > m ? moves[m].moveNumber : 0;
      deltaSeconds = sortedScenarioEvents[s].deltaSeconds;
      moveAndGroupNumbers[sortedScenarioEvents[s].id] = [moveNumber, group];
    }

    return moveAndGroupNumbers;
  }

  private sortAndFilterValueFromField(
    value: DataValue,
    fieldType: DataFieldType,
    cardMap: Map<string, string>,
    userMap: Map<string, string>
  ): string | number {
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

  private indexFields(datafields: DataField[]): Map<string, DataField> {
    const fieldMap = new Map<string, DataField>();
    for (const field of datafields) {
      fieldMap.set(field.id, field);
    }
    return fieldMap;
  }

  private indexUsers(users: User[]): Map<string, string> {
    const userMap = new Map<string, string>();
    if (users) {
      for (const user of users) {
        userMap.set(user.id, user.name);
      }
    }
    return userMap;
  }

  private indexCards(cards: Card[]): Map<string, string> {
    const cardMap = new Map<string, string>();
    if (cards) {
      for (const card of cards) {
        cardMap.set(card.id, card.name);
      }
    }
    return cardMap;
  }

  private indexValues(
    fieldMap: Map<string, DataField>,
    cardMap: Map<string, string>,
    userMap: Map<string, string>,
    dataValues: DataValue[]
  ): Map<string, Map<string, DataValuePlus>> {
    const valueMap = new Map<string, Map<string, DataValuePlus>>();
    for (const value of dataValues) {
      let eventProps = valueMap.get(value.scenarioEventId);
      if (!eventProps) {
        eventProps = new Map<string, DataValuePlus>();
        valueMap.set(value.scenarioEventId, eventProps);
      }
      const fieldType = fieldMap.get(value.dataFieldId);
      if (fieldType) {
        const sortAndFilterVal = this.sortAndFilterValueFromField(
          value,
          fieldType.dataType,
          cardMap,
          userMap
        );
        const dataValue: DataValuePlus = {
          ...value,
          sortAndFilterValue: sortAndFilterVal,
          valueArray: value.value ? value.value.split(', ') : [],
          fieldType: fieldType.dataType,
        };
        eventProps.set(fieldType.name, dataValue);
      }
    }

    return valueMap;
  }

  private dataValuesIncludesFilter(
    valueMap: Map<string, DataValuePlus>,
    filterString: string
  ) {
    for (const val of valueMap.values()) {
      if (
        val.sortAndFilterValue &&
        val.sortAndFilterValue.toString().toLowerCase().includes(filterString)
      ) {
        return true;
      }
    }
    return false;
  }

  private cloneAndFilterScenarioEvents(
    scenarioEvents: ScenarioEvent[],
    valueMap: Map<string, Map<string, DataValuePlus>>,
    filterString: string,
    showHidden: boolean
  ): ScenarioEvent[] {
    const clonedList: ScenarioEvent[] = [];
    if (scenarioEvents && scenarioEvents.length > 0) {
      scenarioEvents.forEach((scenarioEvent) => {
        if (!scenarioEvent.isHidden || showHidden) {
          const eventValues = valueMap.get(scenarioEvent.id);
          if (eventValues) {
            if (
              !filterString ||
              this.dataValuesIncludesFilter(
                eventValues,
                filterString.toLowerCase()
              )
            ) {
              const newScenarioEvent = { ...scenarioEvent };
              clonedList.push(newScenarioEvent);
            }
          }
        }
      });
    }
    return clonedList;
  }

  private getValueFromEvent(
    view: ScenarioEventView,
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): DataValuePlus {
    if ('deltaSeconds' === dataFieldName) {
      const value = +scenarioEvent.deltaSeconds;
      return {
        ...this.blankDataValue,
        value: value.toString(),
        fieldType: DataFieldType.Integer,
        scenarioEventId: scenarioEvent.id,
        sortAndFilterValue: value,
        valueArray: [value.toString()],
      };
    } else if ('groupOrder' === dataFieldName) {
      const value = +scenarioEvent.groupOrder;
      return {
        ...this.blankDataValue,
        value: value.toString(),
        fieldType: DataFieldType.Integer,
        scenarioEventId: scenarioEvent.id,
        sortAndFilterValue: value,
        valueArray: [value.toString()],
      };
    } else {
      const eventMap = view.viewIndex.valueMap.get(scenarioEvent.id);
      const val = eventMap ? eventMap.get(dataFieldName) : '';
      if (val) {
        return val;
      }
      return { ...this.blankDataValue, scenarioEventId: scenarioEvent.id };
    }
  }

  private getSortAndFilterValueFromEvent(
    scenarioEvent: ScenarioEvent,
    valueMap: Map<string, Map<string, DataValuePlus>>,
    fieldName: string
  ): string | number {
    if ('deltaSeconds' === fieldName) {
      return +scenarioEvent.deltaSeconds;
    } else if ('groupOrder' === fieldName) {
      return +scenarioEvent.groupOrder;
    } else {
      const eventMap = valueMap.get(scenarioEvent.id);
      const val = eventMap ? eventMap.get(fieldName) : '';
      if (val) {
        return val.sortAndFilterValue;
      }
      return '';
    }
  }

  private getNumOrDefault(value: string | number): number {
    if (typeof value !== undefined && typeof value !== null) {
      return +value;
    }
    return Number.NEGATIVE_INFINITY;
  }

  private sortAsNumbers(
    a: string | number,
    b: string | number,
    isAsc: boolean
  ): number {
    const dir = isAsc ? 1 : -1;
    const numValA = this.getNumOrDefault(a);
    const numValB = this.getNumOrDefault(b);
    let numSortVal = 0;
    if (+numValA < +numValB) {
      numSortVal = -1;
    } else if (+numValA > +numValB) {
      numSortVal = 1;
    }
    return numSortVal ? numSortVal * dir : numSortVal;
  }

  private sortAsStrings(
    a: string | number,
    b: string | number,
    isAsc: boolean
  ): number {
    const dir = isAsc ? 1 : -1;
    const strSortVal = Intl.Collator().compare(
      a ? a.toString().trim().toLowerCase() : '',
      b ? b.toString().trim().toLowerCase() : ''
    );
    return strSortVal ? strSortVal * dir : strSortVal;
  }

  private sortScenarioEventImpl(
    a: ScenarioEvent,
    b: ScenarioEvent,
    sorts: Sort[],
    valueMap: Map<string, Map<string, DataValuePlus>>
  ): number {
    let sortVal = 0;
    for (const sort of sorts) {
      const isAsc = sort.direction === 'asc';
      const sortValA = this.getSortAndFilterValueFromEvent(
        a,
        valueMap,
        sort.active
      );
      const sortValB = this.getSortAndFilterValueFromEvent(
        b,
        valueMap,
        sort.active
      );
      if (typeof sortValA === 'number' || typeof sortValB === 'number') {
        sortVal = this.sortAsNumbers(sortValA, sortValB, isAsc);
      } else {
        sortVal = this.sortAsStrings(sortValA, sortValB, isAsc);
      }
      if (sortVal) {
        return sortVal;
      }
    }
    return sortVal;
  }

  private sortScenarioEvents(
    scenarioEvents: ScenarioEvent[],
    sort: Sort,
    valueMap: Map<string, Map<string, DataValuePlus>>
  ): ScenarioEvent[] {
    const sorts: Sort[] = [];
    if (sort && sort.active && sort.direction) {
      sorts.push(sort);
    }
    sorts.push(...this.baseSort);
    scenarioEvents.sort((a: ScenarioEvent, b: ScenarioEvent) =>
      this.sortScenarioEventImpl(a, b, sorts, valueMap)
    );
    return scenarioEvents;
  }
}
