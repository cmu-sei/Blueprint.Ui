/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { PlayerApplication } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface PlayerApplicationState extends EntityState<PlayerApplication> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'playerApplications' })
export class PlayerApplicationStore extends EntityStore<PlayerApplicationState> {
  constructor() {
    super();
  }
}
