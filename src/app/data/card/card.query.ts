/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Order, Query, QueryConfig, QueryEntity } from '@datorama/akita';
import {
  CardState,
  CardStore,
} from './card.store';
import { Card } from 'src/app/generated/blueprint.api';
import { Injectable, inject } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class CardQuery extends QueryEntity<CardState> {
  protected store: CardStore;

  constructor() {
    const store = inject(CardStore);

    super(store);
  
    this.store = store;
  }

  selectById(id: string): Observable<Card> {
    return this.selectEntity(id);
  }
}
