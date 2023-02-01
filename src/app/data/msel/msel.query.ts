// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  MselState,
  MselStore,
} from './msel.store';
import { Msel } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class MselQuery extends QueryEntity<MselState> {
  constructor(protected store: MselStore) {
    super(store);
  }

  selectById(id: string): Observable<Msel> {
    return this.selectEntity(id);
  }

  getById(id: string): Msel {
    return this.getAll().find(m => m.id === id);
  }

  getByScenarioEventId(scenarioEventId: string): Msel {
    return this.getAll().find(m => m.scenarioEvents.find(se => se.id === scenarioEventId));
  }

}
