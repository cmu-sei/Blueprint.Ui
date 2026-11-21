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

  // what each list read in flight has seen arrive since it was asked for: the runs updated, and the results updated
  // (or, as null, deleted)
  private readonly loadsInFlight = new Set<{
    runs: Set<string>;
    results: Map<string, AutomationResult | null>;
  }>();

  /** Replaces the MSEL's runs of the kind with the API's, newest 2000 first. */
  loadByMsel(mselId: string, kind: AutomationRunKind) {
    this.store.setLoading(true);
    // What arrives over SignalR while the list is read is newer than the answer, so it is recorded, rather than compared
    // by clock: a run updated meanwhile is not removed for being missing from the answer, and keeps its newer status,
    // and a result updated or deleted meanwhile stays as it arrived. The answer's other results are added, since a run's
    // broadcast carries none.
    const touched = {
      runs: new Set<string>(),
      results: new Map<string, AutomationResult | null>(),
    };
    this.loadsInFlight.add(touched);
    this.automationService
      .getAutomationRunsByMsel(mselId, kind)
      .pipe(take(1))
      .subscribe({
        next: (runs) => {
          this.loadsInFlight.delete(touched);
          runs.forEach((r) => this.setAsDates(r));
          const answered = new Set(runs.map((r) => r.id));
          this.store.remove(
            (r: AutomationRun) =>
              r.mselId === mselId &&
              r.kind === kind &&
              !answered.has(r.id) &&
              !touched.runs.has(r.id),
          );
          const newer = [...touched.results.values()].filter(
            (r): r is AutomationResult => !!r,
          );
          this.store.upsertMany(
            runs.map((run) => {
              const results = byIteration([
                ...(run.results ?? []).filter(
                  (r) => !touched.results.has(r.id),
                ),
                ...newer.filter((r) => r.runId === run.id),
              ]);
              const current = touched.runs.has(run.id)
                ? this.query.getEntity(run.id)
                : undefined;
              return { ...(current ?? run), results };
            }),
          );
          this.store.setLoading(false);
        },
        error: (error) => {
          this.loadsInFlight.delete(touched);
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
    this.loadsInFlight.forEach((touched) => touched.runs.add(run.id));
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
    this.setResultDates(result);
    // kept for a list read in flight, whose answer may hold an older copy, or the run this page does not have yet
    this.loadsInFlight.forEach((touched) =>
      touched.results.set(result.id, result),
    );
    const run = this.query.getEntity(result.runId);
    if (!run) return;
    const results = (run.results ?? []).filter((r) => r.id !== result.id);
    results.push(result);
    this.store.update(run.id, { results: byIteration(results) });
  }

  deleteResult(id: string) {
    this.loadsInFlight.forEach((touched) => touched.results.set(id, null));
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

/** A run's results, newest iteration first, then by VM. */
function byIteration(results: AutomationResult[]): AutomationResult[] {
  return [...results].sort(
    (a, b) =>
      (b.iteration ?? 0) - (a.iteration ?? 0) ||
      (a.vmName ?? '').localeCompare(b.vmName ?? ''),
  );
}
