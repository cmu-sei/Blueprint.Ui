/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  DataFieldState,
  DataFieldStore,
} from './data-field.store';
import { DataField } from 'src/app/generated/blueprint.api';
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
export class DataFieldQuery extends QueryEntity<DataFieldState> {
  constructor(protected store: DataFieldStore) {
    super(store);
  }

  selectById(id: string): Observable<DataField> {
    return this.selectEntity(id);
  }
}
