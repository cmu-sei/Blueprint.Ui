/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the 
 project root for license information.
*/

// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { DataField } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface DataFieldState extends EntityState<DataField> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'dataFields' })
export class DataFieldStore extends EntityStore<DataFieldState> {
  constructor() {
    super();
  }
}
