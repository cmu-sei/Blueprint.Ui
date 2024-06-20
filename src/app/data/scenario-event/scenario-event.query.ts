/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, Query, QueryConfig, QueryEntity, SortBy } from '@datorama/akita';
import {
  ScenarioEventState,
  ScenarioEventStore,
} from './scenario-event.store';
import { ScenarioEvent } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const querySort = (a: ScenarioEvent, b: ScenarioEvent, m: ScenarioEventState): number => {
  let sortResult = +a.deltaSeconds - +b.deltaSeconds;
  if (0 === sortResult) {
    sortResult = +a.groupOrder - +b.groupOrder;
  }
  return sortResult;
};

@QueryConfig({
  sortBy: querySort
})
@Injectable({
  providedIn: 'root',
})
export class ScenarioEventQuery extends QueryEntity<ScenarioEventState> {
  constructor(protected store: ScenarioEventStore) {
    super(store);
  }

  selectById(id: string): Observable<ScenarioEvent> {
    return this.selectEntity(id);
  }
}
