// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { MselAttackTechnique } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselAttackTechniqueState extends EntityState<MselAttackTechnique> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselAttackTechniques' })
export class MselAttackTechniqueStore extends EntityStore<MselAttackTechniqueState> {
  constructor() {
    super();
  }
}
