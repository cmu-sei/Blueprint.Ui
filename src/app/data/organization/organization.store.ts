// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { Organization } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface OrganizationState extends EntityState<Organization> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'organizations' })
export class OrganizationStore extends EntityStore<OrganizationState> {
  constructor() {
    super();
  }
}
