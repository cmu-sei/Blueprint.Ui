// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { MselTeam } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselTeamState extends EntityState<MselTeam> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselTeams' })
export class MselTeamStore extends EntityStore<MselTeamState> {
  constructor() {
    super();
  }
}
