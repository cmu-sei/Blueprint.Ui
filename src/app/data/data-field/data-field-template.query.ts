/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  DataFieldTemplateState,
  DataFieldTemplateStore,
} from './data-field-template.store';
import { DataField } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class DataFieldTemplateQuery extends QueryEntity<DataFieldTemplateState> {
  constructor(protected store: DataFieldTemplateStore) {
    super(store);
  }

  selectById(id: string): Observable<DataField> {
    return this.selectEntity(id);
  }
}
