// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CatalogState,
  CatalogStore,
} from './catalog.store';
import { Catalog } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class CatalogQuery extends QueryEntity<CatalogState> {
  constructor(protected store: CatalogStore) {
    super(store);
  }

  selectById(id: string): Observable<Catalog> {
    return this.selectEntity(id);
  }
}
