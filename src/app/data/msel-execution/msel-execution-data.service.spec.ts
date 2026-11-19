// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
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
});
