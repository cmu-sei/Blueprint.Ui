/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Injectable } from '@angular/core';
import { AutomationTask } from 'src/app/generated/blueprint.api';

export type AutomationTaskState = EntityState<AutomationTask>;

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'automationTasks' })
export class AutomationTaskStore extends EntityStore<AutomationTaskState> {
  constructor() {
    super();
  }
}
