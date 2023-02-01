// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { Move } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MoveState extends EntityState<Move> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'moves' })
export class MoveStore extends EntityStore<MoveState> {
  constructor() {
    super();
  }
}
