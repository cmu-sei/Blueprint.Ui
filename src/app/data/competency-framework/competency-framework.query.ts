// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CompetencyFrameworkState,
  CompetencyFrameworkStore,
} from './competency-framework.store';
import { CompetencyFramework } from 'src/app/generated/blueprint.api';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class CompetencyFrameworkQuery extends QueryEntity<CompetencyFrameworkState> {
  protected store: CompetencyFrameworkStore;

  constructor() {
    const store = inject(CompetencyFrameworkStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<CompetencyFramework> {
    return this.selectEntity(id);
  }
}
