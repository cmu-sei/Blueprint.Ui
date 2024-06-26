/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { DataField } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface DataFieldTemplateState extends EntityState<DataField> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'dataFieldTemplates' })
export class DataFieldTemplateStore extends EntityStore<DataFieldTemplateState> {
  constructor() {
    super();
  }
}
