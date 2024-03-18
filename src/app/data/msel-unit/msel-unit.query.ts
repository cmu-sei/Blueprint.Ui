// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  MselUnitState,
  MselUnitStore,
} from './msel-unit.store';
import { MselUnit } from 'src/app/generated/blueprint.api';
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
export class MselUnitQuery extends QueryEntity<MselUnitState> {
  constructor(protected store: MselUnitStore) {
    super(store);
  }

  selectById(id: string): Observable<MselUnit> {
    return this.selectEntity(id);
  }
}
