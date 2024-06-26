// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  InjectTypeState,
  InjectTypeStore,
} from './inject-type.store';
import { InjectType } from 'src/app/generated/blueprint.api';
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
export class InjectTypeQuery extends QueryEntity<InjectTypeState> {
  constructor(protected store: InjectTypeStore) {
    super(store);
  }

  selectById(id: string): Observable<InjectType> {
    return this.selectEntity(id);
  }
}
