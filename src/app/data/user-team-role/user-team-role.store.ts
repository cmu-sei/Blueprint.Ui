// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { UserTeamRole } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface UserTeamRoleState extends EntityState<UserTeamRole> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'userTeamRoles' })
export class UserTeamRoleStore extends EntityStore<UserTeamRoleState> {
  constructor() {
    super();
  }
}
