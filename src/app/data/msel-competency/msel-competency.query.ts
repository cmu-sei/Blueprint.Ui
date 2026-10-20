// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  MselCompetencyState,
  MselCompetencyStore,
} from './msel-competency.store';
import { MselCompetency } from 'src/app/generated/blueprint.api';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'competencyId',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class MselCompetencyQuery extends QueryEntity<MselCompetencyState> {
  protected store: MselCompetencyStore;

  constructor() {
    const store = inject(MselCompetencyStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<MselCompetency> {
    return this.selectEntity(id);
  }
}
