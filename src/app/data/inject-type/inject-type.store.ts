// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { InjectType } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface InjectTypeState extends EntityState<InjectType> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'injectTypes' })
export class InjectTypeStore extends EntityStore<InjectTypeState> {
  constructor() {
    super();
  }
}
