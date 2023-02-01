// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  MoveState,
  MoveStore,
} from './move.store';
import { Move } from 'src/app/generated/blueprint.api';
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
export class MoveQuery extends QueryEntity<MoveState> {
  constructor(protected store: MoveStore) {
    super(store);
  }

  selectById(id: string): Observable<Move> {
    return this.selectEntity(id);
  }
}
