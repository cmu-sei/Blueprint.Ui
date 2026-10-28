// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  TeamUserState,
  TeamUserStore,
} from './team-user.store';
import { TeamUser } from 'src/app/generated/blueprint.api';
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
export class TeamUserQuery extends QueryEntity<TeamUserState> {
  protected store: TeamUserStore;

  constructor() {
    const store = inject(TeamUserStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<TeamUser> {
    return this.selectEntity(id);
  }
}
