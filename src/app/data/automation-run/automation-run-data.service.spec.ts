// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
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
