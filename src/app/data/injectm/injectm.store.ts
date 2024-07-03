// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { Injectm } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface InjectmState extends EntityState<Injectm> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'injectms' })
export class InjectmStore extends EntityStore<InjectmState> {
  constructor() {
    super();
  }
}
