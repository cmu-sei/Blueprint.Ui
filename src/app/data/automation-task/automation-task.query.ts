/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { QueryEntity } from '@datorama/akita';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AutomationTask } from 'src/app/generated/blueprint.api';
import {
  AutomationTaskState,
  AutomationTaskStore,
} from './automation-task.store';

// a scenario event's tasks run in list order unless a trigger says otherwise
export const byDisplayOrder = (a: AutomationTask, b: AutomationTask) =>
  (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
  (a.name ?? '').localeCompare(b.name ?? '');

@Injectable({
  providedIn: 'root',
})
export class AutomationTaskQuery extends QueryEntity<AutomationTaskState> {
  protected store: AutomationTaskStore;

  constructor() {
    const store = inject(AutomationTaskStore);
    super(store);
    this.store = store;
  }

  selectByScenarioEvent(scenarioEventId: string): Observable<AutomationTask[]> {
    return this.selectAll({
      filterBy: (t) => t.scenarioEventId === scenarioEventId,
      sortBy: byDisplayOrder,
    });
  }

  getByScenarioEvent(scenarioEventId: string): AutomationTask[] {
    return this.getAll({
      filterBy: (t) => t.scenarioEventId === scenarioEventId,
      sortBy: byDisplayOrder,
    });
  }
}
