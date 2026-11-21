// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of } from 'rxjs';
import {
  AutomationRun,
  AutomationRunForm,
  AutomationRunSource,
  AutomationService,
  AutomationStatus,
  AutomationTask,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DeploymentRuns } from 'src/app/utilities/facilitation';
import { AutomationResultsDrawerComponent } from './automation-results-drawer.component';

const TASK: AutomationTask = {
  id: 't-2',
  name: 'Collect IIS log',
  enabled: true,
  repeatable: true,
};
const RUNS: AutomationRun[] = [
  {
    id: 'r-3',
    automationTaskId: 't-2',
    deploymentId: 'dep-1',
    source: AutomationRunSource.Rerun,
    requestedBy: 'user-1',
    status: AutomationStatus.Running,
    results: [],
  },
  {
    id: 'r-2',
    automationTaskId: 't-2',
    deploymentId: 'dep-1',
    source: AutomationRunSource.Chain,
    status: AutomationStatus.Failed,
    statusDetail: 'exit code 1',
    results: [
      {
        id: 'res-a',
        iteration: 2,
        vmName: 'web-01',
        status: AutomationStatus.Failed,
        actualOutput: 'denied',
      },
      {
        id: 'res-b',
        iteration: 1,
        vmName: 'web-01',
        status: AutomationStatus.Failed,
        actualOutput: 'denied',
        outputTruncated: true,
      },
    ],
  },
  // an earlier deployment's run is not this one's history
  {
    id: 'r-1',
    automationTaskId: 't-2',
    deploymentId: 'dep-0',
    status: AutomationStatus.Succeeded,
  },
];

async function renderDrawer(canAct = true, runs: AutomationRun[] = RUNS) {
  const api = {
    rerunAutomationRun: vi.fn<
      (id: string, form?: AutomationRunForm) => Observable<AutomationRun>
    >(() =>
      of({
        id: 'r-4',
        automationTaskId: 't-2',
        status: AutomationStatus.Pending,
      }),
    ),
    cancelAutomationRun: vi.fn<(id: string) => Observable<AutomationRun>>(() =>
      of({ ...RUNS[0], cancelRequested: true }),
    ),
  } satisfies ApiStub<AutomationService>;
  const rendered = await renderComponent(AutomationResultsDrawerComponent, {
    providers: [{ provide: AutomationService, useValue: api }],
    inputs: {
      task: TASK,
      label: 'Event 4 › 2. Collect IIS log',
      runs: new DeploymentRuns(runs, 'dep-1'),
      canAct,
      userNames: new Map([['user-1', 'Facilitator Fran']]),
    },
  });
  return { ...rendered, api };
}

describe('AutomationResultsDrawerComponent', () => {
  /**
   * Verifies: the history lists this deployment's runs newest first, with what started each and who, how it ended, and each iteration and VM's output.
   * Interacts with: DeploymentRuns, the run and result entries.
   * Data: a rerun by Facilitator Fran still running, a chained run that failed over two iterations, and a run of an earlier deployment.
   */
  it('lists the deployment runs with their results', async () => {
    await renderDrawer();

    expect(
      screen.getByRole('heading', { name: 'Event 4 › 2. Collect IIS log' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Run again · Facilitator Fran/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Triggered by another task · Blueprint/),
    ).toBeInTheDocument();
    expect(screen.getByText('exit code 1')).toBeInTheDocument();
    expect(screen.getAllByText('denied')).toHaveLength(2);
    expect(screen.getByText('The output was cut short.')).toBeInTheDocument();
    expect(screen.queryByText('Succeeded')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a facilitator cancels the run that has not ended; an older run of the task is not rerun while that one goes.
   * Interacts with: AutomationService.cancelAutomationRun (stub), cannotRerun.
   * Data: r-3 running, r-2 failed, both of t-2.
   */
  it('cancels a run, and reruns none of the task while it goes', async () => {
    const { api } = await renderDrawer();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.cancelAutomationRun).toHaveBeenCalledWith('r-3');
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeDisabled();
  });

  /**
   * Verifies: once the task's newest run has ended, a facilitator reruns an earlier one.
   * Interacts with: AutomationService.rerunAutomationRun (stub).
   * Data: r-3 cancelled, r-2 failed; rerun r-2.
   */
  it('reruns a run once the task has none going', async () => {
    const { api } = await renderDrawer(true, [
      { ...RUNS[0], status: AutomationStatus.Cancelled },
      ...RUNS.slice(1),
    ]);

    const reruns = screen.getAllByRole('button', { name: 'Rerun' });
    await userEvent.setup().click(reruns[reruns.length - 1]);

    expect(api.rerunAutomationRun).toHaveBeenCalledWith('r-2', {
      triggerChain: true,
    });
  });

  /**
   * Verifies: read-only, the history has no Cancel or Rerun.
   * Interacts with: canAct.
   * Data: canAct false.
   */
  it('is read-only without the right to act', async () => {
    await renderDrawer(false);

    expect(
      screen.queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rerun' }),
    ).not.toBeInTheDocument();
  });
});
