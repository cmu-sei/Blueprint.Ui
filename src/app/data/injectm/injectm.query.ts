// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  InjectmState,
  InjectmStore,
} from './injectm.store';
import { Injectm } from 'src/app/generated/blueprint.api';
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
export class InjectmQuery extends QueryEntity<InjectmState> {
  constructor(protected store: InjectmStore) {
    super(store);
  }

  selectById(id: string): Observable<Injectm> {
    return this.selectEntity(id);
  }
}
