// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { MselPage } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselPageState extends EntityState<MselPage> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'mselPages' })
export class MselPageStore extends EntityStore<MselPageState> {
  constructor() {
    super();
  }
}
