// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { TechniqueRelease } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export type TechniqueReleaseState = EntityState<TechniqueRelease>;

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'techniqueReleases' })
export class TechniqueReleaseStore extends EntityStore<TechniqueReleaseState> {
  constructor() {
    super();
  }
}
