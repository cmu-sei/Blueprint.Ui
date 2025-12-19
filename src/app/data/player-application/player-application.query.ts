/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  PlayerApplicationState,
  PlayerApplicationStore,
} from './player-application.store';
import { PlayerApplication } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class PlayerApplicationQuery extends QueryEntity<PlayerApplicationState> {
  constructor(protected store: PlayerApplicationStore) {
    super(store);
  }

  selectById(id: string): Observable<PlayerApplication> {
    return this.selectEntity(id);
  }
}
