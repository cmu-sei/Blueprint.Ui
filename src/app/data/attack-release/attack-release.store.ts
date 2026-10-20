// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { AttackRelease } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface AttackReleaseState extends EntityState<AttackRelease> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'attackReleases' })
export class AttackReleaseStore extends EntityStore<AttackReleaseState> {
  constructor() {
    super();
  }
}
