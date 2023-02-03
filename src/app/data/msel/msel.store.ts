/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { Msel } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface MselState extends EntityState<Msel> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'msels' })
export class MselStore extends EntityStore<MselState> {
  constructor() {
    super();
  }
}
