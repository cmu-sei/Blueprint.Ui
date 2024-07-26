// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import { CatalogInjectState, CatalogInjectStore } from './catalog-inject.store';
import { CatalogInject } from 'src/app/generated/blueprint.api';
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
export class CatalogInjectQuery extends QueryEntity<CatalogInjectState> {
  constructor(protected store: CatalogInjectStore) {
    super(store);
  }

  selectById(id: string): Observable<CatalogInject> {
    return this.selectEntity(id);
  }
}
