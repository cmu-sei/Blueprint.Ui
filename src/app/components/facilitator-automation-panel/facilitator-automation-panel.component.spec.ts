// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, throwError } from 'rxjs';
import {
  AutomationRun,
  AutomationRunForm,
  AutomationService,
  AutomationStatus,
  AutomationTask,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DeploymentRuns } from 'src/app/utilities/facilitation';
import { FacilitatorAutomationPanelComponent } from './facilitator-automation-panel.component';

const TASKS: AutomationTask[] = [
  {
    id: 't-1',
    name: 'Snapshot web-01',
    enabled: true,
    triggerCondition: AutomationTrigger.AtEventTime,
  },
  {
    id: 't-2',
    name: 'Collect IIS log',
    enabled: true,
    triggerCondition: AutomationTrigger.OnSuccess,
    triggerTaskId: 't-1',
  },
  {
    id: 't-3',
    name: 'Notify Blue Team',
    enabled: true,
    triggerCondition: AutomationTrigger.Manual,
  },
];
const RUNS: AutomationRun[] = [
  {
    id: 'r-2',
    automationTaskId: 't-2',
    deploymentId: 'dep-1',
    status: AutomationStatus.Failed,
    startedAt: new Date('2026-01-01T10:45:09Z'),
    results: [{ id: 'res-2', vmName: 'web-01', actualOutput: 'exit code 1' }],
  },
  {
    id: 'r-1',
    automationTaskId: 't-1',
    deploymentId: 'dep-1',
    status: AutomationStatus.Running,
    results: [{ id: 'res-1', vmName: 'web-01' }],
  },
];

async function renderPanel(canAct = true) {
  const api = {
    runAutomationTask: vi.fn<
      (id: string, form?: AutomationRunForm) => Observable<AutomationRun>
    >(() =>
      of({
        id: 'new',
        automationTaskId: 't-3',
        status: AutomationStatus.Pending,
      }),
    ),
    rerunAutomationRun: vi.fn<
      (id: string, form?: AutomationRunForm) => Observable<AutomationRun>
    >(() =>
      of({
        id: 'again',
        automationTaskId: 't-2',
        status: AutomationStatus.Pending,
      }),
    ),
    cancelAutomationRun: vi.fn<(id: string) => Observable<AutomationRun>>(() =>
      of({ ...RUNS[1], cancelRequested: true }),
    ),
  } satisfies ApiStub<AutomationService>;
  const rendered = await renderComponent(FacilitatorAutomationPanelComponent, {
    providers: [{ provide: AutomationService, useValue: api }],
    inputs: {
      tasks: TASKS,
      runs: new DeploymentRuns(RUNS, 'dep-1'),
      canAct,
      taskNames: new Map(TASKS.map((t) => [t.id, t.name])),
    },
  });
  const opened: AutomationTask[] = [];
  rendered.fixture.componentInstance.history.subscribe((t) => opened.push(t));
  return { ...rendered, api, opened };
}

const row = (name: string) =>
  within(
    screen
      .getByRole('cell', { name: new RegExp(`^\\d+\\. ${name}$`) })
      .closest('tr') as HTMLElement,
  );

describe('FacilitatorAutomationPanelComponent', () => {
  /**
   * Verifies: each task shows its trigger, the newest run's status, VMs and output, and the action that fits: Cancel while it runs, Rerun once it ended, Run when it never ran.
   * Interacts with: the task rows, DeploymentRuns.
   * Data: t-1 running on web-01, t-2 failed with "exit code 1", t-3 never run.
   */
  it('shows each task and the action that fits it', async () => {
    await renderPanel();

    expect(
      row('Collect IIS log').getByText('On success of Snapshot web-01'),
    ).toBeInTheDocument();
    expect(row('Collect IIS log').getByText('exit code 1')).toBeInTheDocument();
    expect(row('Collect IIS log').getByText('Failed')).toBeInTheDocument();
    expect(
      row('Snapshot web-01').getByRole('button', {
        name: 'Cancel Snapshot web-01',
      }),
    ).toBeInTheDocument();
    expect(
      row('Collect IIS log').getByRole('button', {
        name: 'Rerun Collect IIS log',
      }),
    ).toBeEnabled();
    expect(
      row('Notify Blue Team').getByRole('button', {
        name: 'Run Notify Blue Team',
      }),
    ).toBeEnabled();
  });

  /**
   * Verifies: Run, Rerun and Cancel reach the API for the task or run they name, and History hands the task up.
   * Interacts with: AutomationService.runAutomationTask / rerunAutomationRun / cancelAutomationRun (stubs), the history output.
   * Data: run t-3, rerun r-2, cancel r-1, open the history of t-2.
   */
  it('runs, reruns, cancels and opens the history', async () => {
    const { api, opened } = await renderPanel();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Run Notify Blue Team' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rerun Collect IIS log' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Cancel Snapshot web-01' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'History of Collect IIS log' }),
    );

    expect(api.runAutomationTask).toHaveBeenCalledWith('t-3', {
      triggerChain: true,
    });
    expect(api.rerunAutomationRun).toHaveBeenCalledWith('r-2', {
      triggerChain: true,
    });
    expect(api.cancelAutomationRun).toHaveBeenCalledWith('r-1');
    expect(opened.map((t) => t.id)).toEqual(['t-2']);
  });

  /**
   * Verifies: a refused run is said in the panel.
   * Interacts with: AutomationService.runAutomationTask (stub), errorMessage.
   * Data: the API refuses t-3.
   */
  it('says when a task could not be run', async () => {
    const { api } = await renderPanel();
    api.runAutomationTask.mockReturnValueOnce(
      throwError(() => new Error('409')),
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run Notify Blue Team' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Notify Blue Team could not be run.',
    );
  });

  /**
   * Verifies: read-only, there is no Run, Rerun or Cancel, only History.
   * Interacts with: canAct.
   * Data: canAct false.
   */
  it('offers only the history without the right to act', async () => {
    await renderPanel(false);

    expect(
      screen.queryByRole('button', { name: /^(Run|Rerun|Cancel) / }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^History of / }),
    ).toHaveLength(3);
  });
});
