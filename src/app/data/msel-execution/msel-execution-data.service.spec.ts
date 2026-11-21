// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import {
  MselAdvanceResult,
  MselExecution,
  MselExecutionService,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { MselExecutionDataService } from './msel-execution-data.service';

function execution(overrides: Partial<MselExecution> = {}): MselExecution {
  return {
    mselId: 'msel-1',
    startTime: '2026-01-01T10:00:00Z' as unknown as Date,
    currentMoveNumber: 1,
    currentGroupNumber: 0,
    automationPaused: false,
    positions: [{ scenarioEventId: 'se-1', moveNumber: 1, groupNumber: 0 }],
    ...overrides,
  };
}

function setup() {
  const api = {
    getMselExecution: vi.fn(() => of<MselExecution>(execution())),
    startMselMove: vi.fn(() =>
      of<MselAdvanceResult>({
        execution: execution({ currentMoveNumber: 2 }),
        succeeded: true,
      }),
    ),
    startMselGroup: vi.fn(() =>
      of<MselAdvanceResult>({
        execution: execution({
          currentGroupNumber: 3,
          currentGroupStartedAt: '2026-01-01T10:30:00Z' as unknown as Date,
        }),
        succeeded: true,
      }),
    ),
    setMselAutomationPaused: vi.fn(() =>
      of<MselExecution>(execution({ automationPaused: true })),
    ),
  } satisfies ApiStub<MselExecutionService>;
  TestBed.configureTestingModule({
    providers: [{ provide: MselExecutionService, useValue: api }],
  });
  return { service: TestBed.inject(MselExecutionDataService), api };
}

describe('MselExecutionDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: load keeps each MSEL's execution apart, with its dates parsed.
   * Interacts with: MselExecutionService.getMselExecution (stub), select, get.
   * Data: msel-1 at move 1, then msel-2.
   */
  it('load keeps one execution per MSEL', async () => {
    const { service, api } = setup();
    service.load('msel-1');
    api.getMselExecution.mockReturnValueOnce(
      of(execution({ mselId: 'msel-2', currentMoveNumber: 4 })),
    );
    service.load('msel-2');

    expect(
      (await firstValueFrom(service.select('msel-1'))).currentMoveNumber,
    ).toBe(1);
    expect(service.get('msel-2').currentMoveNumber).toBe(4);
    expect(service.get('msel-1').startTime).toEqual(
      new Date('2026-01-01T10:00:00Z'),
    );
  });

  /**
   * Verifies: the API's numbers, which it sends as strings, are stored as numbers, so the current move compares with a move's number.
   * Interacts with: updateStore.
   * Data: an execution with its current move, group and positions as strings, and none current.
   */
  it('stores the numbers as numbers', () => {
    const { service } = setup();
    service.updateStore(
      execution({
        currentMoveNumber: '2' as unknown as number,
        currentGroupNumber: '1' as unknown as number,
        positions: [
          {
            scenarioEventId: 'se-1',
            moveNumber: '2' as unknown as number,
            groupNumber: '1' as unknown as number,
          },
        ],
      }),
    );

    const stored = service.get('msel-1');
    expect(stored.currentMoveNumber).toBe(2);
    expect(stored.currentGroupNumber).toBe(1);
    expect(stored.positions[0]).toEqual({
      scenarioEventId: 'se-1',
      moveNumber: 2,
      groupNumber: 1,
    });

    service.updateStore(
      execution({ currentMoveNumber: null, currentGroupNumber: null }),
    );
    expect(service.get('msel-1').currentMoveNumber).toBeNull();
  });

  /**
   * Verifies: starting a move or group sends the manual tasks chosen to run and stores the position the API answers; pausing stores the pause.
   * Interacts with: MselExecutionService.startMselMove / startMselGroup / setMselAutomationPaused (stubs).
   * Data: msel-1 moved to move 2 running t-1 then t-2; group 3 of move 2 with none; paused.
   */
  it('startMove, startGroup and setPaused store the new execution', async () => {
    const { service, api } = setup();

    await firstValueFrom(service.startMove('msel-1', 2, ['t-1', 't-2']));
    expect(api.startMselMove).toHaveBeenCalledWith('msel-1', 2, {
      runTaskIds: ['t-1', 't-2'],
    });
    expect(service.get('msel-1').currentMoveNumber).toBe(2);

    await firstValueFrom(service.startGroup('msel-1', 2, 3, []));
    expect(api.startMselGroup).toHaveBeenCalledWith('msel-1', 2, 3, {
      runTaskIds: [],
    });
    expect(service.get('msel-1').currentGroupStartedAt).toBeInstanceOf(Date);

    await firstValueFrom(service.setPaused('msel-1', true));
    expect(api.setMselAutomationPaused).toHaveBeenCalledWith('msel-1', {
      paused: true,
    });
    expect(service.get('msel-1').automationPaused).toBe(true);
  });

  /**
   * Verifies: a pause the API refuses does not make a read in flight count as overtaken, so its answer is still stored; one the API takes does.
   * Interacts with: load (answering later), setPaused (refused, then taken).
   * Data: a read answering move 3; a refused pause; a second read answering move 4, overtaken by a taken pause.
   */
  it('a refused action leaves the read in flight standing', async () => {
    const { service, api } = setup();
    const read = new Subject<MselExecution>();
    api.getMselExecution.mockReturnValueOnce(read);
    api.setMselAutomationPaused.mockReturnValueOnce(
      throwError(() => new Error('409')),
    );

    service.load('msel-1');
    await expect(
      firstValueFrom(service.setPaused('msel-1', true)),
    ).rejects.toThrow('409');
    read.next(execution({ currentMoveNumber: 3 }));
    expect(service.get('msel-1').currentMoveNumber).toBe(3);

    const second = new Subject<MselExecution>();
    api.getMselExecution.mockReturnValueOnce(second);
    service.load('msel-1');
    await firstValueFrom(service.setPaused('msel-1', true));
    second.next(execution({ currentMoveNumber: 4 }));
    expect(service.get('msel-1').currentMoveNumber).toBe(1);
    expect(service.get('msel-1').automationPaused).toBe(true);
  });

  /**
   * Verifies: a start whose answer is late does not make a read asked for after it count as overtaken: the start's answer is stored, then the newer read's.
   * Interacts with: startMove (answering later), load (asked after it, answering later).
   * Data: this facilitator's start of move 2; another's start of move 3 brings a read, which answers move 3 after the start answers.
   */
  it('a late answer to a start does not drop a newer read', async () => {
    const { service, api } = setup();
    const started = new Subject<MselAdvanceResult>();
    api.startMselMove.mockReturnValueOnce(started);
    const read = new Subject<MselExecution>();
    api.getMselExecution.mockReturnValueOnce(read);

    const start = firstValueFrom(service.startMove('msel-1', 2, []));
    service.load('msel-1');
    started.next({
      execution: execution({ currentMoveNumber: 2 }),
      succeeded: true,
    });
    started.complete();
    await start;
    expect(service.get('msel-1').currentMoveNumber).toBe(2);
    read.next(execution({ currentMoveNumber: 3 }));

    expect(service.get('msel-1').currentMoveNumber).toBe(3);
  });
});
