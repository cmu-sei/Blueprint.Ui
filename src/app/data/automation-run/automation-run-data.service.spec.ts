// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import {
  AutomationResult,
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationStatus,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { AutomationRunDataService } from './automation-run-data.service';
import { AutomationRunQuery } from './automation-run.query';

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1',
    mselId: 'msel-1',
    automationTaskId: 't-1',
    kind: AutomationRunKind.Exercise,
    status: AutomationStatus.Running,
    dateCreated: '2026-01-01T10:00:00Z' as unknown as Date,
    dueAt: '2026-01-01T10:00:00Z' as unknown as Date,
    results: [],
    ...overrides,
  };
}

function result(overrides: Partial<AutomationResult> = {}): AutomationResult {
  return {
    id: 'res-1',
    runId: 'run-1',
    iteration: 1,
    vmName: 'web-01',
    status: AutomationStatus.Succeeded,
    statusAt: '2026-01-01T10:00:05Z' as unknown as Date,
    ...overrides,
  };
}

function setup() {
  const api = {
    getAutomationRunsByMsel: vi.fn(() => of<AutomationRun[]>([])),
    runAutomationTask: vi.fn(() => of<AutomationRun>(run())),
    rerunAutomationRun: vi.fn(() => of<AutomationRun>(run({ id: 'run-2' }))),
    cancelAutomationRun: vi.fn(() =>
      of<AutomationRun>(run({ cancelRequested: true })),
    ),
    testAutomationTask: vi.fn(() =>
      of<AutomationRun>(run({ id: 'test-1', kind: AutomationRunKind.Test })),
    ),
  } satisfies ApiStub<AutomationService>;
  TestBed.configureTestingModule({
    providers: [{ provide: AutomationService, useValue: api }],
  });
  return {
    service: TestBed.inject(AutomationRunDataService),
    query: TestBed.inject(AutomationRunQuery),
    api,
  };
}

const ids = (list: AutomationRun[]) => list.map((r) => r.id);

describe('AutomationRunDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the MSEL's runs of one kind, newest first with dates parsed, and leaves its runs of the other kind and another MSEL's alone.
   * Interacts with: AutomationService.getAutomationRunsByMsel (stub), AutomationRunQuery.selectByMsel.
   * Data: a stale exercise run, a test run, another MSEL's run; the API answers two exercise runs at 10:00 and 11:00.
   */
  it('loadByMsel replaces the runs of the kind', async () => {
    const { service, query, api } = setup();
    service.updateStore(run({ id: 'stale' }));
    service.updateStore(run({ id: 'test', kind: AutomationRunKind.Test }));
    service.updateStore(run({ id: 'other', mselId: 'msel-2' }));
    api.getAutomationRunsByMsel.mockReturnValue(
      of([
        run({ id: 'early' }),
        run({
          id: 'late',
          dateCreated: '2026-01-01T11:00:00Z' as unknown as Date,
        }),
      ]),
    );

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);

    expect(api.getAutomationRunsByMsel).toHaveBeenCalledWith(
      'msel-1',
      AutomationRunKind.Exercise,
    );
    expect(
      ids(
        await firstValueFrom(
          query.selectByMsel('msel-1', AutomationRunKind.Exercise),
        ),
      ),
    ).toEqual(['late', 'early']);
    expect(query.hasEntity('test')).toBe(true);
    expect(query.hasEntity('other')).toBe(true);
    expect(query.getEntity('late').dueAt).toBeInstanceOf(Date);
  });

  /**
   * Verifies: a run that arrives over SignalR while the list is read, and so is not in the answer, is kept; an older one the answer lacks goes.
   * Interacts with: AutomationService.getAutomationRunsByMsel (stub answering later), updateStore.
   * Data: a stale run from before the load; a run created during it; the answer holds neither.
   */
  it('loadByMsel keeps a run that arrives while it loads', () => {
    const { service, query, api } = setup();
    service.updateStore(run({ id: 'stale' }));
    const answer = new Subject<AutomationRun[]>();
    api.getAutomationRunsByMsel.mockReturnValue(answer);

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);
    // created long ago by the server's clock, which a clock comparison would have dropped
    service.updateStore(
      run({ id: 'arrived', dateCreated: new Date('2020-01-01T00:00:00Z') }),
    );
    answer.next([run({ id: 'answered' })]);

    expect(query.hasEntity('arrived')).toBe(true);
    expect(query.hasEntity('answered')).toBe(true);
    expect(query.hasEntity('stale')).toBe(false);
  });

  /**
   * Verifies: a run's newer state, broadcast while the list is read, is not written over by the older state in the answer.
   * Interacts with: loadByMsel (stub answering later), updateStore.
   * Data: run-1 Running in the answer; a broadcast that it Succeeded arrives first.
   */
  it('loadByMsel keeps a run updated while it loads', () => {
    const { service, query, api } = setup();
    service.updateStore(run({ id: 'run-1', status: AutomationStatus.Running }));
    const answer = new Subject<AutomationRun[]>();
    api.getAutomationRunsByMsel.mockReturnValue(answer);

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);
    service.updateStore(
      run({ id: 'run-1', status: AutomationStatus.Succeeded }),
    );
    answer.next([run({ id: 'run-1', status: AutomationStatus.Running })]);

    expect(query.getEntity('run-1').status).toBe(AutomationStatus.Succeeded);
  });

  /**
   * Verifies: a run first seen in a status broadcast while the list is read keeps that newer status and gains the earlier results the answer holds, as the broadcast carries none.
   * Interacts with: loadByMsel (stub answering later), updateStore.
   * Data: an empty store; run-1 Succeeded is broadcast with no results; the answer has run-1 Running with iterations 1 and 2.
   */
  it('loadByMsel adds the answer results to a run broadcast while it loads', () => {
    const { service, query, api } = setup();
    const answer = new Subject<AutomationRun[]>();
    api.getAutomationRunsByMsel.mockReturnValue(answer);

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);
    service.updateStore(
      run({ id: 'run-1', status: AutomationStatus.Succeeded, results: [] }),
    );
    answer.next([
      run({
        id: 'run-1',
        status: AutomationStatus.Running,
        results: [
          result({ id: 'i1', iteration: 1 }),
          result({ id: 'i2', iteration: 2 }),
        ],
      }),
    ]);

    const stored = query.getEntity('run-1');
    expect(stored.status).toBe(AutomationStatus.Succeeded);
    expect(stored.results.map((r) => r.id)).toEqual(['i2', 'i1']);
  });

  /**
   * Verifies: a result broadcast while the list is read, even for a run the store does not hold yet, is not written over by the older copy in the answer; one deleted meanwhile stays deleted.
   * Interacts with: loadByMsel (stub answering later), updateResult, deleteResult.
   * Data: an empty store; res-1 Succeeded with its output is broadcast and res-2 deleted; the answer has res-1 Running and res-2.
   */
  it('loadByMsel keeps a result broadcast while it loads', () => {
    const { service, query, api } = setup();
    const answer = new Subject<AutomationRun[]>();
    api.getAutomationRunsByMsel.mockReturnValue(answer);

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);
    service.updateResult(
      result({
        id: 'res-1',
        status: AutomationStatus.Succeeded,
        actualOutput: 'done',
      }),
    );
    service.deleteResult('res-2');
    answer.next([
      run({
        id: 'run-1',
        results: [
          result({ id: 'res-1', status: AutomationStatus.Running }),
          result({ id: 'res-2', vmName: 'web-02' }),
        ],
      }),
    ]);

    const results = query.getEntity('run-1').results;
    expect(results.map((r) => [r.id, r.status, r.actualOutput])).toEqual([
      ['res-1', AutomationStatus.Succeeded, 'done'],
    ]);
  });

  /**
   * Verifies: a run answered with its results while the list is read, as a test's poll answers it, keeps those results over the older ones in the answer.
   * Interacts with: loadByMsel (stub answering later), updateStore with results.
   * Data: the poll answers run-1 Succeeded with res-1 done; the list's answer has run-1 Running and res-1 Running.
   */
  it('loadByMsel keeps the results of a run polled while it loads', () => {
    const { service, query, api } = setup();
    const answer = new Subject<AutomationRun[]>();
    api.getAutomationRunsByMsel.mockReturnValue(answer);

    service.loadByMsel('msel-1', AutomationRunKind.Exercise);
    service.updateStore(
      run({
        id: 'run-1',
        status: AutomationStatus.Succeeded,
        results: [
          result({ status: AutomationStatus.Succeeded, actualOutput: 'done' }),
        ],
      }),
    );
    answer.next([
      run({
        id: 'run-1',
        status: AutomationStatus.Running,
        results: [result({ status: AutomationStatus.Running })],
      }),
    ]);

    const stored = query.getEntity('run-1');
    expect(stored.status).toBe(AutomationStatus.Succeeded);
    expect(stored.results.map((r) => [r.status, r.actualOutput])).toEqual([
      [AutomationStatus.Succeeded, 'done'],
    ]);
  });

  /**
   * Verifies: a run that arrives without results keeps the results the store has, and one with results replaces them.
   * Interacts with: updateStore, AutomationRunQuery.
   * Data: run-1 with res-1; an update with no results; then one carrying res-2.
   */
  it('updateStore keeps the results a broadcast leaves out', () => {
    const { service, query } = setup();
    service.updateStore(run({ results: [result()] }));

    service.updateStore(
      run({ status: AutomationStatus.Succeeded, results: [] }),
    );
    expect(query.getEntity('run-1').status).toBe(AutomationStatus.Succeeded);
    expect(query.getEntity('run-1').results.map((r) => r.id)).toEqual([
      'res-1',
    ]);
    expect(query.getEntity('run-1').results[0].statusAt).toBeInstanceOf(Date);

    service.updateStore(run({ results: [result({ id: 'res-2' })] }));
    expect(query.getEntity('run-1').results.map((r) => r.id)).toEqual([
      'res-2',
    ]);
  });

  /**
   * Verifies: a run's results are kept newest iteration first, then by VM name, and a result for a run the store lacks is dropped.
   * Interacts with: updateResult, deleteResult.
   * Data: run-1; results for iteration 1 on web-02 and web-01, iteration 2 on web-01; a result of run-9.
   */
  it('updateResult orders a run results', () => {
    const { service, query } = setup();
    service.updateStore(run());

    service.updateResult(result({ id: 'a', vmName: 'web-02' }));
    service.updateResult(result({ id: 'b', vmName: 'web-01' }));
    service.updateResult(result({ id: 'c', iteration: 2 }));
    service.updateResult(result({ id: 'x', runId: 'run-9' }));

    expect(query.getEntity('run-1').results.map((r) => r.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(query.hasEntity('run-9')).toBe(false);

    service.deleteResult('b');
    expect(query.getEntity('run-1').results.map((r) => r.id)).toEqual([
      'c',
      'a',
    ]);
  });

  /**
   * Verifies: run, rerun, cancel and test call the API, passing whether to trigger the chain, and store the run each answers.
   * Interacts with: AutomationService.runAutomationTask / rerunAutomationRun / cancelAutomationRun / testAutomationTask (stubs).
   * Data: task t-1 run without its chain; run-1 rerun and cancelled; a draft test of se-1 on view v-1.
   */
  it('run, rerun, cancel and test store the run the API answers', async () => {
    const { service, query, api } = setup();

    await firstValueFrom(service.run('t-1', false));
    await firstValueFrom(service.rerun('run-1'));
    await firstValueFrom(service.cancel('run-1'));
    await firstValueFrom(
      service.test({
        scenarioEventId: 'se-1',
        playerViewId: 'v-1',
        task: { name: 'Draft' },
      }),
    );

    expect(api.runAutomationTask).toHaveBeenCalledWith('t-1', {
      triggerChain: false,
    });
    expect(api.rerunAutomationRun).toHaveBeenCalledWith('run-1', {
      triggerChain: true,
    });
    expect(api.cancelAutomationRun).toHaveBeenCalledWith('run-1');
    expect(api.testAutomationTask).toHaveBeenCalledWith({
      scenarioEventId: 'se-1',
      playerViewId: 'v-1',
      task: { name: 'Draft' },
    });
    expect(query.getEntity('run-1').cancelRequested).toBe(true);
    expect(ids(query.getAll()).sort()).toEqual(['run-1', 'run-2', 'test-1']);
  });
});
