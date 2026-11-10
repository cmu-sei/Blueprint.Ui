/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/
import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  TeamState,
  TeamStore,
} from './team.store';
import { Team } from 'src/app/generated/blueprint.api';
import { Injectable, inject } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class TeamQuery extends QueryEntity<TeamState> {
  protected store: TeamStore;

  constructor() {
    const store = inject(TeamStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<Team> {
    return this.selectEntity(id);
  }
}
