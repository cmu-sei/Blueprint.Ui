// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CiteRoleState,
  CiteRoleStore,
} from './citeRole.store';
import { CiteRole } from 'src/app/generated/blueprint.api';
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
export class CiteRoleQuery extends QueryEntity<CiteRoleState> {
  constructor(protected store: CiteRoleStore) {
    super(store);
  }

  selectById(id: string): Observable<CiteRole> {
    return this.selectEntity(id);
  }
}
