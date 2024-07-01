// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { CatalogUnit } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface CatalogUnitState extends EntityState<CatalogUnit> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'catalogUnits' })
export class CatalogUnitStore extends EntityStore<CatalogUnitState> {
  constructor() {
    super();
  }
}
