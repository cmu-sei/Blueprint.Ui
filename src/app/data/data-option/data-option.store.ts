// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { DataOption } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface DataOptionState extends EntityState<DataOption> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'dataOptions' })
export class DataOptionStore extends EntityStore<DataOptionState> {
  constructor() {
    super();
  }
}
