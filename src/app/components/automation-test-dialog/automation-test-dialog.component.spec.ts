// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Subject, of, throwError } from 'rxjs';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationStatus,
  AutomationTestForm,
  AutomationVmPreview,
  PlayerService,
  View,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  AutomationTaskDraft,
  newDraft,
} from 'src/app/utilities/automation-tasks';
import {
  AutomationTestDialogComponent,
  AutomationTestDialogData,
} from './automation-test-dialog.component';

const POWER_ON: AutomationActionDefinition = {
  action: AutomationAction.VmHwPowerOn,
  category: 'VM',
  display: 'Power on',
  requiresVm: true,
  requires: ['playerView'],
  parameters: [],
};
const SITUATION: AutomationActionDefinition = {
  action: AutomationAction.CiteSituationUpdate,
  category: 'Blueprint',
  display: 'Update the CITE situation',
  requires: ['cite'],
  isDryRunWhenTested: true,
  parameters: [],
};
const VIEWS: View[] = [
  { id: 'v-2', name: 'Range Dev Sandbox' },
  { id: 'v-1', name: 'Exercise View' },
];

function powerOn(id = 't-1'): AutomationTaskDraft {
  return { ...newDraft(POWER_ON), id, name: 'Power on WS-01', vmMask: 'ws-01' };
}

async function renderTest(
  data: Partial<AutomationTestDialogData> = {},
  apis: {
    preview?: AutomationVmPreview;
    views?: () => ReturnType<PlayerService['getMyPlayerViews']>;
  } = {},
) {
  const runs = new Subject<AutomationRun>();
  const automationApi = {
    getAutomationActions: vi.fn(() =>
      of(structuredClone([POWER_ON, SITUATION])),
    ),
    previewAutomationTaskVms: vi.fn(() =>
      of(
        apis.preview ?? {
          matchMode: 'name',
          vms: [{ id: 'vm-1', name: 'WS-01' }],
        },
      ),
    ),
    testAutomationTask: vi.fn((form?: AutomationTestForm) =>
      of<AutomationRun>({
        id: 'test-1',
        kind: AutomationRunKind.Test,
        automationTaskId: form?.taskId ?? null,
        status: AutomationStatus.Pending,
        results: [],
      }),
    ),
    getAutomationRun: vi.fn(() => runs.asObservable()),
    getAutomationRunsByMsel: vi.fn(() =>
      of<AutomationRun[]>([
        {
          id: 'old-1',
          mselId: 'msel-1',
          automationTaskId: 't-1',
          kind: AutomationRunKind.Test,
          status: AutomationStatus.Failed,
          dateCreated: new Date('2026-01-01T10:58:00Z'),
        },
      ]),
    ),
  } satisfies ApiStub<AutomationService>;
  const playerApi = {
    getMyPlayerViews: vi.fn(apis.views ?? (() => of(structuredClone(VIEWS)))),
  } satisfies ApiStub<PlayerService>;
  const fullData: AutomationTestDialogData = {
    mselId: 'msel-1',
    scenarioEventId: 'se-1',
    eventLabel: 'Event 4',
    tasks: [powerOn()],
    savedTaskIds: ['t-1'],
    playerViewId: 'v-1',
    deployedPlayerViewId: null,
    ...data,
  };
  const rendered = await renderComponent(AutomationTestDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: fullData },
      { provide: AutomationService, useValue: automationApi },
      { provide: PlayerService, useValue: playerApi },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, automationApi, playerApi, runs };
}

describe('AutomationTestDialogComponent', () => {
  /**
   * Verifies: the dialog offers the user's Player views by name with the MSEL's test view chosen, and previews the VMs the task's mask matches there.
   * Interacts with: PlayerService.getMyPlayerViews and AutomationService.previewAutomationTaskVms (stubs).
   * Data: views Range Dev Sandbox and Exercise View, the MSEL's being v-1; a Power on task for "ws-01" matching WS-01.
   */
  it('chooses the test view and previews the VMs', async () => {
    const { automationApi } = await renderTest();

    expect(
      screen.getByRole('combobox', { name: 'Player view' }),
    ).toHaveTextContent('Exercise View');
    expect(automationApi.previewAutomationTaskVms).toHaveBeenLastCalledWith(
      'msel-1',
      {
        playerViewId: 'v-1',
        vmMask: 'ws-01',
      },
    );
    expect(screen.getByText(/1 VM:\s*WS-01/)).toBeInTheDocument();
    expect(screen.getByText(/This action runs for real/)).toBeInTheDocument();
  });

  /**
   * Verifies: a mask that matches no VM in the view says so and keeps Run Test disabled.
   * Interacts with: canRun, the preview.
   * Data: a preview with no VMs.
   */
  it('will not run a VM task that matches no VM', async () => {
    await renderTest({}, { preview: { matchMode: 'name', vms: [] } });

    expect(screen.getByText('no VM in this view matches.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Test' })).toBeDisabled();
  });

  /**
   * Verifies: Run Test sends the task as it is in the editor, saved or not, with the view and chain choice; the run's progress and results follow it to its end, and the earlier tests are listed.
   * Interacts with: AutomationService.testAutomationTask and getAutomationRun (stubs), the run store.
   * Data: saved task t-1 with the chain included; a result on WS-01 that succeeds; an earlier failed test.
   */
  it('runs the test and follows its results', async () => {
    // real timers: a fake clock installed with shouldAdvanceTime left later suites unable to fake Date
    const { automationApi, runs, fixture } = await renderTest();
    const user = userEvent.setup();

    expect(screen.getByText(/Previous tests:/)).toHaveTextContent('Failed');
    await user.click(
      screen.getByRole('checkbox', { name: /chained after it/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Run Test' }));

    expect(automationApi.testAutomationTask).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioEventId: 'se-1',
        taskId: 't-1',
        playerViewId: 'v-1',
        includeChain: true,
      }),
    );
    expect(automationApi.testAutomationTask.mock.calls[0][0].task).toEqual(
      expect.objectContaining({ name: 'Power on WS-01', vmMask: 'ws-01' }),
    );
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();

    // the dialog asks the API for the run every two seconds
    await vi.waitFor(
      () =>
        expect(automationApi.getAutomationRun).toHaveBeenCalledWith('test-1'),
      { timeout: 4000 },
    );
    runs.next({
      id: 'test-1',
      kind: AutomationRunKind.Test,
      automationTaskId: 't-1',
      status: AutomationStatus.Succeeded,
      results: [
        {
          id: 'res-1',
          runId: 'test-1',
          iteration: 1,
          vmName: 'WS-01',
          status: AutomationStatus.Succeeded,
          actualOutput: 'powered on',
        },
      ],
    });
    fixture.detectChanges();

    expect(screen.getByRole('cell', { name: 'WS-01' })).toBeInTheDocument();
    expect(screen.getByText('powered on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Test' })).toBeEnabled();
  });

  /**
   * Verifies: a draft that was never saved is tested without a task id, cannot include a chain, and has no earlier tests to list.
   * Interacts with: isSaved, AutomationService.testAutomationTask (stub).
   * Data: an unsaved task t-new.
   */
  it('tests an unsaved task as a draft', async () => {
    const { automationApi } = await renderTest({
      tasks: [powerOn('t-new')],
      savedTaskIds: [],
    });

    expect(
      screen.getByRole('checkbox', { name: /chained after it/ }),
    ).toBeDisabled();
    expect(automationApi.getAutomationRunsByMsel).not.toHaveBeenCalled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run Test' }));
    expect(automationApi.testAutomationTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: null, includeChain: false }),
    );
  });

  /**
   * Verifies: a CITE action is described as only saying what it would do, and testing on the deployed exercise's own view is called out.
   * Interacts with: isDryRunWhenTested, touchesDeployedView.
   * Data: a CITE situation update; the deployed view is v-1, which is chosen.
   */
  it('warns about dry runs and the deployed view', async () => {
    await renderTest({
      tasks: [{ ...newDraft(SITUATION), id: 't-1', name: 'Calm' }],
      deployedPlayerViewId: 'v-1',
    });

    expect(
      screen.getByText(/only describes what it would do/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This is the view of the deployed exercise.'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a refused test is shown in the dialog, and Run Test can be tried again.
   * Interacts with: AutomationService.testAutomationTask (stub), errorMessage.
   * Data: the API answers 400 with a detail.
   */
  it('shows why a test was refused', async () => {
    const { automationApi } = await renderTest();
    automationApi.testAutomationTask.mockReturnValueOnce(
      throwError(() => ({
        error: { detail: 'The view is not one of yours.' },
      })),
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run Test' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The view is not one of yours.',
    );
    expect(screen.getByRole('button', { name: 'Run Test' })).toBeEnabled();
  });

  /**
   * Verifies: when the user's Player views cannot be read the dialog says there is nothing to test against, and a view-bound action cannot run.
   * Interacts with: PlayerService.getMyPlayerViews (stub), canRun.
   * Data: the views request fails.
   */
  it('says when the Player views cannot be read', async () => {
    await renderTest({}, { views: () => throwError(() => new Error('down')) });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your Player views could not be read',
    );
    expect(screen.getByRole('button', { name: 'Run Test' })).toBeDisabled();
  });
});
