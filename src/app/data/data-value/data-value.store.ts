/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { DataValue } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface DataValueState extends EntityState<DataValue> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'dataValues' })
export class DataValueStore extends EntityStore<DataValueState> {
  constructor() {
    super();
  }
}
