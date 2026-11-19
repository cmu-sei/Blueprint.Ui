/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, inject } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  AutomationService,
  AutomationTask,
} from 'src/app/generated/blueprint.api';
import { AutomationTaskStore } from './automation-task.store';

/**
 * A MSEL's automation tasks. They are written with their scenario event (ScenarioEventFields.automationTasks), so this
 * service only reads them and keeps the store current from SignalR.
 */
@Injectable({
  providedIn: 'root',
})
export class AutomationTaskDataService {
  private store = inject(AutomationTaskStore);
  private automationService = inject(AutomationService);

  loadByMsel(mselId: string) {
    this.store.setLoading(true);
    this.automationService
      .getAutomationTasksByMsel(mselId)
      .pipe(take(1))
      .subscribe({
        next: (tasks) => {
          tasks.forEach((t) => this.setAsDates(t));
          this.store.set(tasks);
          this.store.setLoading(false);
        },
        error: (error) => {
          this.store.set([]);
          this.store.setLoading(false);
          throw error;
        },
      });
  }

  /** Refreshes one event's tasks, dropping any the event no longer has. */
  loadByScenarioEvent(scenarioEventId: string) {
    this.automationService
      .getAutomationTasksByScenarioEvent(scenarioEventId)
      .pipe(take(1))
      .subscribe((tasks) => {
        tasks.forEach((t) => this.setAsDates(t));
        const kept = new Set(tasks.map((t) => t.id));
        this.store.remove(
          (t: AutomationTask) =>
            t.scenarioEventId === scenarioEventId && !kept.has(t.id),
        );
        this.store.upsertMany(tasks);
      });
  }

  updateStore(task: AutomationTask) {
    this.setAsDates(task);
    this.store.upsert(task.id, task);
  }

  deleteFromStore(id: string) {
    this.store.remove(id);
  }

  setAsDates(task: AutomationTask) {
    task.dateCreated = task.dateCreated ? new Date(task.dateCreated) : null;
    task.dateModified = task.dateModified ? new Date(task.dateModified) : null;
  }
}
