// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CatalogUnitState,
  CatalogUnitStore,
} from './catalog-unit.store';
import { CatalogUnit } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { LegacyPageEvent as PageEvent } from '@angular/material/legacy-paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class CatalogUnitQuery extends QueryEntity<CatalogUnitState> {
  constructor(protected store: CatalogUnitStore) {
    super(store);
  }

  selectById(id: string): Observable<CatalogUnit> {
    return this.selectEntity(id);
  }
}
