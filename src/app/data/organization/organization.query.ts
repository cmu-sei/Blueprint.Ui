/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  OrganizationState,
  OrganizationStore,
} from './organization.store';
import { Organization } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class OrganizationQuery extends QueryEntity<OrganizationState> {
  constructor(protected store: OrganizationStore) {
    super(store);
  }

  selectById(id: string): Observable<Organization> {
    return this.selectEntity(id);
  }
}
