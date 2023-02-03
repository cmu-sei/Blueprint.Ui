// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { EntityState, EntityStore, Store, StoreConfig } from '@datorama/akita';
import { CiteRole } from 'src/app/generated/blueprint.api';
import { Injectable } from '@angular/core';

export interface CiteRoleState extends EntityState<CiteRole> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'citeRoles' })
export class CiteRoleStore extends EntityStore<CiteRoleState> {
  constructor() {
    super();
  }
}
