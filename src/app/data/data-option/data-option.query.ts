/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the 
 project root for license information.
*/

// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  DataOptionState,
  DataOptionStore,
} from './data-option.store';
import { DataOption } from 'src/app/generated/blueprint.api';
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
export class DataOptionQuery extends QueryEntity<DataOptionState> {
  constructor(protected store: DataOptionStore) {
    super(store);
  }

  selectById(id: string): Observable<DataOption> {
    return this.selectEntity(id);
  }
}
