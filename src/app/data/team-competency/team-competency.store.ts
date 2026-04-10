// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { TeamCompetency } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface TeamCompetencyState extends EntityState<TeamCompetency> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'teamCompetencies' })
export class TeamCompetencyStore extends EntityStore<TeamCompetencyState> {
  constructor() {
    super();
  }
}
