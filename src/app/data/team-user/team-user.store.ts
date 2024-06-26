// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { TeamUser } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface TeamUserState extends EntityState<TeamUser> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'teamUsers' })
export class TeamUserStore extends EntityStore<TeamUserState> {
  constructor() {
    super();
  }
}
