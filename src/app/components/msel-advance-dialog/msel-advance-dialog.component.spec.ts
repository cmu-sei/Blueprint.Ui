// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Observable, of, throwError } from 'rxjs';
import {
  AutomationTrigger,
  MselAdvanceForm,
  MselAdvanceResult,
  MselExecutionService,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  MselAdvanceDialogComponent,
  MselAdvanceDialogData,
} from './msel-advance-dialog.component';

const TASKS = [
  {
    task: {
      id: 't-1',
      name: 'Snapshot web-01',
      enabled: true,
      triggerCondition: AutomationTrigger.Manual,
    },
    label: 'Event 4 › 1. Snapshot web-01',
  },
  {
    task: {
      id: 't-2',
      name: 'Replace index.html',
      enabled: true,
      triggerCondition: AutomationTrigger.Manual,
    },
    label: 'Event 4 › 2. Replace index.html',
  },
];

async function renderAdvance(
  data: Partial<MselAdvanceDialogData> = {},
  result: () => Observable<MselAdvanceResult> = () =>
    of<MselAdvanceResult>({
      succeeded: true,
      messages: [],
      execution: { mselId: 'msel-1' },
    }),
) {
  const api = {
    startMselMove: vi.fn<
      (
        id: string,
        move: number,
        form?: MselAdvanceForm,
      ) => Observable<MselAdvanceResult>
    >(() => result()),
    startMselGroup: vi.fn<
      (
        id: string,
        move: number,
        group: number,
        form?: MselAdvanceForm,
      ) => Observable<MselAdvanceResult>
    >(() => result()),
  } satisfies ApiStub<MselExecutionService>;
  const close = vi.fn();
  await renderComponent(MselAdvanceDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          mselId: 'msel-1',
          moveNumber: 1,
          hasCite: true,
          hasGallery: true,
          tasks: TASKS,
          ...data,
        } satisfies MselAdvanceDialogData,
      },
      { provide: MselExecutionService, useValue: api },
      {
        provide: MatDialogRef,
        useValue: {
          close,
          disableClose: false,
          keydownEvents: () => of(),
          backdropClick: () => of(),
        },
      },
    ],
  });
  return { api, close };
}

describe('MselAdvanceDialogComponent', () => {
  /**
   * Verifies: starting a move says it moves CITE and Gallery, offers the move's manual tasks all chosen, and sends only those still chosen, in order.
   * Interacts with: MselExecutionService.startMselMove (stub), MatDialogRef.close.
   * Data: move 1 of a MSEL using CITE and Gallery; two manual tasks, the second unticked.
   */
  it('starts a move with the tasks chosen', async () => {
    const { api, close } = await renderAdvance();
    const user = userEvent.setup();

    expect(
      screen.getByRole('heading', { name: 'Start Move 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Set the CITE evaluation to move 1'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Set the Gallery exhibit to move 1, inject\s+0/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('checkbox', { name: 'Event 4 › 2. Replace index.html' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Move' }));

    expect(api.startMselMove).toHaveBeenCalledWith('msel-1', 1, {
      runTaskIds: ['t-1'],
    });
    expect(close).toHaveBeenCalled();
  });

  /**
   * Verifies: a task that runs once and has succeeded is offered unticked and disabled, with why, and is not sent.
   * Interacts with: MselExecutionService.startMselMove (stub).
   * Data: the first task cannot run again.
   */
  it('leaves out a task that cannot run again', async () => {
    const { api } = await renderAdvance({
      tasks: [
        { ...TASKS[0], cannotRun: 'it has succeeded, and runs only once' },
        TASKS[1],
      ],
    });

    const once = screen.getByRole('checkbox', { name: /Snapshot web-01/ });
    expect(once).not.toBeChecked();
    expect(once).toBeDisabled();
    expect(
      screen.getByText('(it has succeeded, and runs only once)'),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Start Move' }));

    expect(api.startMselMove).toHaveBeenCalledWith('msel-1', 1, {
      runTaskIds: ['t-2'],
    });
  });

  /**
   * Verifies: starting a group moves only Gallery, says when there is no manual task, and names the group.
   * Interacts with: MselExecutionService.startMselGroup (stub).
   * Data: move 1 group 3 with no manual tasks.
   */
  it('starts a group', async () => {
    const { api } = await renderAdvance({ groupNumber: 3, tasks: [] });

    expect(
      screen.getByRole('heading', { name: 'Start Move 1 · Group 3' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/CITE evaluation/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/The group has no manual tasks/),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Start Group' }));

    expect(api.startMselGroup).toHaveBeenCalledWith('msel-1', 1, 3, {
      runTaskIds: [],
    });
  });

  /**
   * Verifies: when an integration refused, the dialog stays open and says what was not changed; the move was still made current, so its button becomes Close, which starts nothing again.
   * Interacts with: MselExecutionService.startMselMove (stub), errorMessage, the submit button.
   * Data: a result that did not succeed with Gallery's message.
   */
  it('stays open to say what went wrong', async () => {
    const result: MselAdvanceResult = {
      succeeded: false,
      messages: ['The Gallery exhibit could not be moved: 404'],
    };
    const { api, close } = await renderAdvance({}, () =>
      of<MselAdvanceResult>(result),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Start Move' }));

    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'The Gallery exhibit could not be moved',
    );
    expect(
      screen.queryByRole('button', { name: 'Start Move' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(api.startMselMove).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(result);
  });

  /**
   * Verifies: a refused request leaves the dialog open saying nothing was changed.
   * Interacts with: MselExecutionService.startMselMove (stub).
   * Data: the API answers an error.
   */
  it('says a refused start changed nothing', async () => {
    const { close } = await renderAdvance({}, () =>
      throwError(() => new Error('409')),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Start Move' }));

    expect(close).not.toHaveBeenCalled();
    expect(
      screen.getByText('Start Move 1 failed. Nothing was changed; try again.'),
    ).toBeInTheDocument();
  });
});
