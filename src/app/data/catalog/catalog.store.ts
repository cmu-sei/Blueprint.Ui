// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { Catalog } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface CatalogState extends EntityState<Catalog> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'catalogs' })
export class CatalogStore extends EntityStore<CatalogState> {
  constructor() {
    super();
  }
}
