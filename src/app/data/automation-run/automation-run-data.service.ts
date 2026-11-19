/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { take, tap } from 'rxjs/operators';
import {
  AutomationResult,
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationTestForm,
} from 'src/app/generated/blueprint.api';
import { AutomationRunQuery } from './automation-run.query';
import { AutomationRunStore } from './automation-run.store';

/**
 * Runs of automation tasks, the exercise's and the authors' tests, with their results. A run's broadcast carries no
 * results; they arrive on their own, so a run keeps the results it has until one replaces them.
 */
@Injectable({
  providedIn: 'root',
})
export class AutomationRunDataService {
  private store = inject(AutomationRunStore);
  private query = inject(AutomationRunQuery);
  private automationService = inject(AutomationService);

  /** Replaces the MSEL's runs of the kind with the API's, newest 2000 first. */
  loadByMsel(mselId: string, kind: AutomationRunKind) {
    this.store.setLoading(true);
    this.automationService
      .getAutomationRunsByMsel(mselId, kind)
      .pipe(take(1))
      .subscribe({
        next: (runs) => {
          runs.forEach((r) => this.setAsDates(r));
          this.store.remove(
            (r: AutomationRun) => r.mselId === mselId && r.kind === kind,
          );
          this.store.upsertMany(runs);
          this.store.setLoading(false);
        },
        error: (error) => {
          this.store.setLoading(false);
          throw error;
        },
      });
  }

  /** One task's runs of the kind, added to the store. */
  loadByTask(mselId: string, taskId: string, kind: AutomationRunKind) {
    this.automationService
      .getAutomationRunsByMsel(mselId, kind, taskId)
      .pipe(take(1))
      .subscribe((runs) => {
        runs.forEach((r) => this.setAsDates(r));
        this.store.upsertMany(runs);
      });
  }

  run(taskId: string, triggerChain = true): Observable<AutomationRun> {
    return this.automationService
      .runAutomationTask(taskId, { triggerChain })
      .pipe(tap((r) => this.updateStore(r)));
  }

  rerun(runId: string, triggerChain = true): Observable<AutomationRun> {
    return this.automationService
      .rerunAutomationRun(runId, { triggerChain })
      .pipe(tap((r) => this.updateStore(r)));
  }

  cancel(runId: string): Observable<AutomationRun> {
    return this.automationService
      .cancelAutomationRun(runId)
      .pipe(tap((r) => this.updateStore(r)));
  }

  test(form: AutomationTestForm): Observable<AutomationRun> {
    return this.automationService
      .testAutomationTask(form)
      .pipe(tap((r) => this.updateStore(r)));
  }

  /** A run from the API or a broadcast. One with no results keeps those the store has. */
  updateStore(run: AutomationRun) {
    this.setAsDates(run);
    const existing = this.query.getEntity(run.id);
    const results =
      run.results && run.results.length > 0
        ? run.results
        : (existing?.results ?? []);
    this.store.upsert(run.id, { ...run, results });
  }

  deleteFromStore(id: string) {
    this.store.remove(id);
  }

  /** A result broadcast, for a run the store holds; a result of another run is not this page's. */
  updateResult(result: AutomationResult) {
    const run = this.query.getEntity(result.runId);
    if (!run) return;
    this.setResultDates(result);
    const results = (run.results ?? []).filter((r) => r.id !== result.id);
    results.push(result);
    results.sort(
      (a, b) =>
        (b.iteration ?? 0) - (a.iteration ?? 0) ||
        (a.vmName ?? '').localeCompare(b.vmName ?? ''),
    );
    this.store.update(run.id, { results });
  }

  deleteResult(id: string) {
    const run = this.query
      .getAll()
      .find((r) => (r.results ?? []).some((x) => x.id === id));
    if (!run) return;
    this.store.update(run.id, {
      results: run.results.filter((r) => r.id !== id),
    });
  }

  setAsDates(run: AutomationRun) {
    run.dateCreated = run.dateCreated ? new Date(run.dateCreated) : null;
    run.dateModified = run.dateModified ? new Date(run.dateModified) : null;
    run.dueAt = run.dueAt ? new Date(run.dueAt) : null;
    run.startedAt = run.startedAt ? new Date(run.startedAt) : null;
    run.endedAt = run.endedAt ? new Date(run.endedAt) : null;
    (run.results ?? []).forEach((r) => this.setResultDates(r));
  }

  private setResultDates(result: AutomationResult) {
    result.dateCreated = result.dateCreated
      ? new Date(result.dateCreated)
      : null;
    result.sentAt = result.sentAt ? new Date(result.sentAt) : null;
    result.statusAt = result.statusAt ? new Date(result.statusAt) : null;
  }
}
