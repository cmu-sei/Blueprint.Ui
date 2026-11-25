/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { QueryEntity } from '@datorama/akita';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AutomationRun,
  AutomationRunKind,
} from 'src/app/generated/blueprint.api';
import { AutomationRunState, AutomationRunStore } from './automation-run.store';

// newest first: the history a facilitator reads starts with what just happened
export const newestFirst = (a: AutomationRun, b: AutomationRun) =>
  (b.dateCreated?.valueOf() ?? 0) - (a.dateCreated?.valueOf() ?? 0);

@Injectable({
  providedIn: 'root',
})
export class AutomationRunQuery extends QueryEntity<AutomationRunState> {
  protected store: AutomationRunStore;

  constructor() {
    const store = inject(AutomationRunStore);
    super(store);
    this.store = store;
  }

  selectByMsel(
    mselId: string,
    kind: AutomationRunKind,
  ): Observable<AutomationRun[]> {
    return this.selectAll({
      filterBy: (r) => r.mselId === mselId && r.kind === kind,
      sortBy: newestFirst,
    });
  }

  selectByTask(
    taskId: string,
    kind: AutomationRunKind,
  ): Observable<AutomationRun[]> {
    return this.selectAll({
      filterBy: (r) => r.automationTaskId === taskId && r.kind === kind,
      sortBy: newestFirst,
    });
  }
}
