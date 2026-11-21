// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationService,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';
import { AutomationActionDataService } from './automation-action-data.service';

const CATALOG: AutomationActionDefinition[] = [
  { action: AutomationAction.HttpGet, category: 'HTTP', display: 'GET' },
  { action: AutomationAction.VmHwPowerOn, category: 'VM', display: 'Power On' },
  { action: AutomationAction.HttpPost, category: 'HTTP', display: 'POST' },
  { action: AutomationAction.SendEmail, display: 'Send email' },
];

function setup() {
  const api = {
    getAutomationActions: vi.fn(() =>
      of<AutomationActionDefinition[]>(structuredClone(CATALOG)),
    ),
  } satisfies ApiStub<AutomationService>;
  TestBed.configureTestingModule({
    providers: [{ provide: AutomationService, useValue: api }],
  });
  return { service: TestBed.inject(AutomationActionDataService), api };
}

describe('AutomationActionDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: the catalog is read once however often it is asked for, grouped by category in catalog order, and an action is labelled "Category › Display".
   * Interacts with: AutomationService.getAutomationActions (stub), byCategory, get, label.
   * Data: two HTTP actions around a VM one, and an uncategorised email action.
   */
  it('reads the catalog once and groups it by category', async () => {
    const { service, api } = setup();

    service.load();
    service.load();

    expect(api.getAutomationActions).toHaveBeenCalledTimes(1);
    const groups = await firstValueFrom(service.byCategory);
    expect(
      groups.map(
        (g) => `${g.category}: ${g.actions.map((a) => a.display).join(', ')}`,
      ),
    ).toEqual(['HTTP: GET, POST', 'VM: Power On', 'Other: Send email']);
    expect(service.label(AutomationAction.VmHwPowerOn)).toBe('VM › Power On');
    expect(service.label(AutomationAction.SendEmail)).toBe('Send email');
    expect(service.get(AutomationAction.HttpPost).display).toBe('POST');
  });

  /**
   * Verifies: a failed read reaches the global ErrorHandler and lets the next load ask again.
   * Interacts with: AutomationService.getAutomationActions (stub).
   * Data: a failure, then the catalog.
   */
  it('asks again after a failed read', async () => {
    const { service, api } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('down');
    api.getAutomationActions.mockReturnValueOnce(throwError(() => failure));

    service.load();
    await flush();
    service.load();

    expect(errors).toEqual([failure]);
    expect(api.getAutomationActions).toHaveBeenCalledTimes(2);
    expect((await firstValueFrom(service.actions)).length).toBe(4);
  });
});
