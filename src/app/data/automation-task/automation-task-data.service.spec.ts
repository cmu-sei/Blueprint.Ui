// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  AutomationService,
  AutomationTask,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';
import { AutomationTaskDataService } from './automation-task-data.service';
import { AutomationTaskQuery } from './automation-task.query';

function task(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: 't-1',
    mselId: 'msel-1',
    scenarioEventId: 'se-1',
    name: 'Power on',
    displayOrder: 0,
    dateCreated: '2026-01-01T00:00:00Z' as unknown as Date,
    ...overrides,
  };
}

function setup() {
  const api = {
    getAutomationTasksByMsel: vi.fn(() => of<AutomationTask[]>([])),
  } satisfies ApiStub<AutomationService>;
  TestBed.configureTestingModule({
    providers: [{ provide: AutomationService, useValue: api }],
  });
  return {
    service: TestBed.inject(AutomationTaskDataService),
    query: TestBed.inject(AutomationTaskQuery),
    api,
  };
}

const names = (list: AutomationTask[]) => list.map((t) => t.name);

describe('AutomationTaskDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's tasks, dates parsed; a failure empties it and reaches the global ErrorHandler.
   * Interacts with: AutomationService.getAutomationTasksByMsel (stub), real AutomationTaskStore and AutomationTaskQuery.
   * Data: two tasks, then a failure.
   */
  it('loadByMsel replaces the tasks, or empties them on failure', async () => {
    const { service, query, api } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('boom');
    api.getAutomationTasksByMsel
      .mockReturnValueOnce(of([task(), task({ id: 't-2', name: 'Notify' })]))
      .mockReturnValueOnce(throwError(() => failure));

    service.loadByMsel('msel-1');
    expect(names(query.getAll())).toEqual(['Power on', 'Notify']);
    expect(query.getEntity('t-1').dateCreated).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );

    service.loadByMsel('msel-1');
    await flush();
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: an event's tasks come in display order, then by name, and the delete broadcast removes one.
   * Interacts with: AutomationTaskQuery.selectByScenarioEvent / getByScenarioEvent, deleteFromStore.
   * Data: three tasks on se-1 at display orders 2, 0 and 0, and one on se-2.
   */
  it('lists an event tasks in display order', async () => {
    const { service, query } = setup();
    service.updateStore(task({ id: 'a', name: 'Third', displayOrder: 2 }));
    service.updateStore(task({ id: 'b', name: 'Second', displayOrder: 0 }));
    service.updateStore(task({ id: 'c', name: 'First', displayOrder: 0 }));
    service.updateStore(
      task({ id: 'd', name: 'Elsewhere', scenarioEventId: 'se-2' }),
    );

    expect(
      names(await firstValueFrom(query.selectByScenarioEvent('se-1'))),
    ).toEqual(['First', 'Second', 'Third']);

    service.deleteFromStore('b');
    expect(names(query.getByScenarioEvent('se-1'))).toEqual(['First', 'Third']);
  });
});
