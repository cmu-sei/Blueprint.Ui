// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { MselCompetency } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselCompetencyState extends EntityState<MselCompetency> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselCompetencies' })
export class MselCompetencyStore extends EntityStore<MselCompetencyState> {
  constructor() {
    super();
  }
}
