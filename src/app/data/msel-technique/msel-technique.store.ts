// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { MselTechnique } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselTechniqueState extends EntityState<MselTechnique> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselTechniques' })
export class MselTechniqueStore extends EntityStore<MselTechniqueState> {
  constructor() {
    super();
  }
}
