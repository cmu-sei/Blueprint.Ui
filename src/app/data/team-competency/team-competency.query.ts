// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  TeamCompetencyState,
  TeamCompetencyStore,
} from './team-competency.store';
import { TeamCompetency } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'competencyId',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class TeamCompetencyQuery extends QueryEntity<TeamCompetencyState> {
  constructor(protected store: TeamCompetencyStore) {
    super(store);
  }

  selectById(id: string): Observable<TeamCompetency> {
    return this.selectEntity(id);
  }
}
