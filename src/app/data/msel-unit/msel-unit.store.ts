// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { MselUnit } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselUnitState extends EntityState<MselUnit> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselUnits' })
export class MselUnitStore extends EntityStore<MselUnitState> {
  constructor() {
    super();
  }
}
