// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  AutomationService,
  AutomationStatus,
  ParticipantTask,
  ParticipantTasks,
} from 'src/app/generated/blueprint.api';
import { SignalRService } from 'src/app/services/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { ParticipantTasksPageComponent } from './participant-tasks-page.component';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<unknown>(undefined);
  readonly imageFilePath = input<string>(undefined);
  readonly urlNavigate = output<string>();
}

// the API sends its numbers as strings
const n = (value: number) => `${value}` as unknown as number;

function page(overrides: Partial<ParticipantTasks> = {}): ParticipantTasks {
  return {
    mselId: 'msel-1',
    mselName: 'Exercise Alpha',
    isDeployed: true,
    automationPaused: false,
    score: n(20),
    scoreEarned: n(10),
    tasks: [
      {
        id: 't-1',
        name: 'Collect evidence',
        description: 'Gather the logs',
        status: AutomationStatus.Succeeded,
        canRun: false,
        cannotRunReason: 'The task has succeeded, and runs only once.',
        totalScore: n(10),
        totalScoreEarned: n(10),
      },
      {
        id: 't-2',
        name: 'Report',
        canRun: true,
        totalScore: n(10),
        totalScoreEarned: n(0),
      },
    ],
    ...overrides,
  };
}

async function renderPage(
  options: {
    tasks?: () => Observable<ParticipantTasks>;
    confirm?: boolean;
  } = {},
) {
  const { confirm = true } = options;
  const api = {
    getParticipantTasks: vi.fn<
      (mselId: string) => Observable<ParticipantTasks>
    >(options.tasks ?? (() => of(page()))),
    runParticipantTask: vi.fn<
      (mselId: string, taskId: string) => Observable<ParticipantTask>
    >(() =>
      of({
        id: 't-2',
        name: 'Report',
        status: AutomationStatus.Pending,
        canRun: false,
        cannotRunReason: 'The task is running.',
        totalScore: n(10),
        totalScoreEarned: n(0),
      }),
    ),
  } satisfies ApiStub<AutomationService>;
  const changed = new Subject<string>();
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinParticipantTasks: vi.fn(),
    leaveParticipantTasks: vi.fn(),
    participantTasksChanged$: changed,
  } satisfies Pick<
    SignalRService,
    | 'startConnection'
    | 'joinParticipantTasks'
    | 'leaveParticipantTasks'
    | 'participantTasksChanged$'
  >;
  const dialog = {
    confirm: vi.fn(() => dialogRefStub<unknown, boolean>(confirm).dialogRef),
  } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(ParticipantTasksPageComponent, {
    childStubs: [{ replace: TopbarComponent, with: TopbarStub }],
    providers: [
      { provide: AutomationService, useValue: api },
      { provide: SignalRService, useValue: signalR },
      { provide: CrucibleDialogService, useValue: dialog },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ mselid: 'msel-1' }) },
        },
      },
    ],
  });
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return { ...rendered, api, signalR, dialog, changed };
}

const row = (name: string) =>
  within(screen.getByText(name).closest('tr') as HTMLElement);

describe('ParticipantTasksPageComponent', () => {
  /**
   * Verifies: the page lists the participant's tasks with how each went and its points, the exercise's score, and why a task cannot run; it joins the MSEL's Tasks group.
   * Interacts with: AutomationService.getParticipantTasks (stub), SignalRService (stub).
   * Data: score 10 of 20, as strings; Collect evidence succeeded and runs once; Report can run.
   */
  it('lists the tasks and the score', async () => {
    const { api, signalR } = await renderPage();

    expect(api.getParticipantTasks).toHaveBeenCalledWith('msel-1');
    expect(signalR.joinParticipantTasks).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText(/Score: 10\/20 \(50%\)/)).toBeInTheDocument();
    expect(row('Collect evidence').getByText('Succeeded')).toBeInTheDocument();
    expect(row('Collect evidence').getByText('10/10')).toBeInTheDocument();
    expect(
      row('Collect evidence').getByText(
        'The task has succeeded, and runs only once.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run Collect evidence' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run Report' })).toBeEnabled();
  });

  /**
   * Verifies: a run is confirmed first, and the task then shows as the API answers it; declining runs nothing.
   * Interacts with: CrucibleDialogService.confirm (stub), AutomationService.runParticipantTask (stub).
   * Data: Report confirmed and answered Waiting; then declined.
   */
  it.each([true, false])('runs a task once confirmed: %s', async (confirm) => {
    const { api } = await renderPage({ confirm });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Run Report' }));

    if (confirm) {
      expect(api.runParticipantTask).toHaveBeenCalledWith('msel-1', 't-2');
      expect(row('Report').getByText('Waiting')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Run Report' })).toBeDisabled();
    } else {
      expect(api.runParticipantTask).not.toHaveBeenCalled();
    }
  });

  /**
   * Verifies: the group's change signal for this MSEL reads the tasks again, and another MSEL's does not.
   * Interacts with: SignalRService.participantTasksChanged$ (stub), the 300 ms debounce.
   * Data: a signal for msel-2, then for msel-1.
   */
  it('reads the tasks again when told they changed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { api, changed } = await renderPage();
      api.getParticipantTasks.mockClear();

      changed.next('msel-2');
      await vi.advanceTimersByTimeAsync(400);
      expect(api.getParticipantTasks).not.toHaveBeenCalled();

      changed.next('msel-1');
      await vi.advanceTimersByTimeAsync(400);
      expect(api.getParticipantTasks).toHaveBeenCalledWith('msel-1');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Verifies: a paused or stopped exercise says so, a page without tasks says so, and one the user may not read says why.
   * Interacts with: the page states.
   * Data: one case per row.
   */
  it.each([
    {
      label: 'paused',
      tasks: () => of(page({ automationPaused: true })),
      text: /automation is paused/,
    },
    {
      label: 'not running',
      tasks: () => of(page({ isDeployed: false })),
      text: 'The exercise is not running.',
    },
    {
      label: 'without tasks',
      tasks: () => of(page({ tasks: [], score: n(0) })),
      text: 'There are no tasks for you to run.',
    },
    {
      label: 'refused',
      tasks: () => throwError(() => new Error('403')),
      text: /could not be loaded/,
    },
  ])('says when the page is $label', async ({ tasks, text }) => {
    await renderPage({ tasks });

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
