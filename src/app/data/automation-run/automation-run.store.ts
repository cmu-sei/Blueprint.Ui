/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Injectable } from '@angular/core';
import { AutomationRun } from 'src/app/generated/blueprint.api';

export type AutomationRunState = EntityState<AutomationRun>;

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'automationRuns' })
export class AutomationRunStore extends EntityStore<AutomationRunState> {
  constructor() {
    super();
  }
}
