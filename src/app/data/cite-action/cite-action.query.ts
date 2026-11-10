// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the
// project root for license information or contact permission@sei.cmu.edu for full terms.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CiteActionState,
  CiteActionStore,
} from './cite-action.store';
import { CiteAction } from 'src/app/generated/blueprint.api';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class CiteActionQuery extends QueryEntity<CiteActionState> {
  protected store: CiteActionStore;

  constructor() {
    const store = inject(CiteActionStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<CiteAction> {
    return this.selectEntity(id);
  }
}
