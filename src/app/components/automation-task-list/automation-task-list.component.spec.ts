// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationRun,
  AutomationService,
  AutomationStatus,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  AutomationTaskDraft,
  newDraft,
} from 'src/app/utilities/automation-tasks';
import { AutomationTaskListComponent } from './automation-task-list.component';

const NOTIFY: AutomationActionDefinition = {
  action: AutomationAction.PlayerNotification,
  category: 'Blueprint',
  display: 'Send a Player notification',
  parameters: [
    { key: 'Text', display: 'Text', inputType: 'textArea', required: true },
  ],
};
const SSH: AutomationActionDefinition = {
  action: AutomationAction.CoreRemote,
  category: 'SSH',
  display: 'Run a remote command',
  parameters: [
    { key: 'Hosts', display: 'Hosts', inputType: 'text', required: true },
    { key: 'Text', display: 'Banner', inputType: 'text' },
  ],
};
const POWER_ON: AutomationActionDefinition = {
  action: AutomationAction.VmHwPowerOn,
  category: 'VM',
  display: 'Power on',
  requiresVm: true,
  parameters: [],
};
const CATALOG = [NOTIFY, SSH, POWER_ON];

function notify(id: string, name: string): AutomationTaskDraft {
  return {
    ...newDraft(NOTIFY),
    id,
    name,
    actionParameters: { Text: 'Move 2' },
  };
}

async function renderList(
  drafts: AutomationTaskDraft[],
  options: {
    canEdit?: boolean;
    canTest?: boolean;
    latest?: Map<string, AutomationRun>;
  } = {},
) {
  const { canEdit = true, canTest = false, latest = new Map() } = options;
  const rendered = await renderComponent(AutomationTaskListComponent, {
    providers: [
      {
        provide: AutomationService,
        useValue: {
          getAutomationActions: vi.fn(() => of(structuredClone(CATALOG))),
        } satisfies ApiStub<AutomationService>,
      },
    ],
    inputs: {
      drafts,
      canEdit,
      canTest,
      latestTests: latest,
      triggerOptions: [{ id: 'other-1', label: 'Event 2 › 1. Power on WS-01' }],
    },
  });
  const changes = { count: 0 };
  const tested: AutomationTaskDraft[] = [];
  rendered.fixture.componentInstance.changed.subscribe(() => changes.count++);
  rendered.fixture.componentInstance.test.subscribe((d) => tested.push(d));
  return { ...rendered, drafts, changes, tested };
}

const header = (name: RegExp) => screen.getByRole('button', { name });

describe('AutomationTaskListComponent', () => {
  /**
   * Verifies: each task's header names it in order with its action, trigger and newest test; a disabled one says so.
   * Interacts with: actionLabel, summary, the status chip.
   * Data: a manual notification whose newest test failed, and a disabled one on success of a task of another event.
   */
  it('summarizes each task in its header', async () => {
    const second = {
      ...notify('t-2', 'Notify Red'),
      enabled: false,
      triggerCondition: AutomationTrigger.OnSuccess,
      triggerTaskId: 'other-1',
    };
    await renderList([notify('t-1', 'Notify Blue'), second], {
      latest: new Map([['t-1', { id: 'r', status: AutomationStatus.Failed }]]),
    });

    const first = header(/1\. Notify Blue/);
    expect(first).toHaveTextContent(
      'Blueprint › Send a Player notification · Manual',
    );
    expect(
      within(first).getByRole('img', { name: 'Failed' }),
    ).toBeInTheDocument();
    expect(header(/2\. Notify Red/)).toHaveTextContent(
      'On success of Event 2 › 1. Power on WS-01',
    );
    expect(header(/2\. Notify Red/)).toHaveTextContent('Disabled');
  });

  /**
   * Verifies: Add Task appends an enabled, manual notification, opens it and announces the change; its missing name and text are shown as errors.
   * Interacts with: add, taskErrors, the changed output.
   * Data: an empty list.
   */
  it('adds a task', async () => {
    const { drafts, changes } = await renderList([]);
    const user = userEvent.setup();

    expect(
      screen.getByText('This event has no automation tasks.', { exact: false }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        action: AutomationAction.PlayerNotification,
        triggerCondition: AutomationTrigger.Manual,
        enabled: true,
      }),
    );
    expect(changes.count).toBe(1);
    expect(screen.getByText('A name is required.')).toBeInTheDocument();
    expect(screen.getByText('Text is required.')).toBeInTheDocument();
  });

  /**
   * Verifies: a chained trigger asks for its task, offering this event's other tasks and the other events' tasks apart.
   * Interacts with: setTrigger, localOptions, the trigger task select.
   * Data: two notifications; the second set to On failure of.
   */
  it('offers the tasks a chained trigger can name', async () => {
    const { drafts } = await renderList([
      notify('t-1', 'Notify Blue'),
      notify('t-2', 'Notify Red'),
    ]);
    const user = userEvent.setup();

    await user.click(header(/2\. Notify Red/));
    const triggers = screen.getAllByRole('combobox', { name: 'Trigger' });
    await user.click(triggers[triggers.length - 1]);
    await user.click(
      await screen.findByRole('option', { name: 'On failure of' }),
    );
    await user.click(screen.getByRole('combobox', { name: 'Task' }));

    expect(screen.getByRole('group', { name: 'This event' })).toHaveTextContent(
      '1. Notify Blue',
    );
    expect(
      screen.getByRole('group', { name: 'Other events' }),
    ).toHaveTextContent('Event 2 › 1. Power on WS-01');
    await user.click(screen.getByRole('option', { name: '1. Notify Blue' }));
    expect(drafts[1]).toEqual(
      expect.objectContaining({
        triggerCondition: AutomationTrigger.OnFailure,
        triggerTaskId: 't-1',
      }),
    );
  });

  /**
   * Verifies: changing the action keeps the parameters the new one shares and drops the rest, and a VM action asks for a mask.
   * Interacts with: setAction.
   * Data: a notification with Text and a stray Url, changed to the SSH action (which has a Text), then to Power on.
   */
  it('keeps the shared parameters when the action changes', async () => {
    const task = {
      ...notify('t-1', 'Notify'),
      actionParameters: { Text: 'hi', Url: 'x' },
    };
    const { fixture, drafts } = await renderList([task]);
    const list = fixture.componentInstance;

    list.setAction(drafts[0], AutomationAction.CoreRemote);
    expect(drafts[0].actionParameters).toEqual({ Text: 'hi' });

    list.setAction(drafts[0], AutomationAction.VmHwPowerOn);
    fixture.detectChanges();
    await userEvent.setup().click(header(/1\. Notify/));
    expect(
      screen.getByRole('textbox', { name: 'VM mask' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A VM mask is required, since the action runs on VMs.'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: deleting a task makes those it triggered manual, as the API does; Duplicate copies a task below it.
   * Interacts with: remove, duplicate.
   * Data: t-2 on success of t-1; t-1 deleted; t-2 duplicated.
   */
  it('deletes and duplicates tasks', async () => {
    const second = {
      ...notify('t-2', 'Notify Red'),
      triggerCondition: AutomationTrigger.OnSuccess,
      triggerTaskId: 't-1',
    };
    const { fixture, drafts } = await renderList([
      notify('t-1', 'Notify Blue'),
      second,
    ]);
    const list = fixture.componentInstance;

    list.remove(drafts[0]);
    expect(drafts.map((d) => d.id)).toEqual(['t-2']);
    expect(drafts[0].triggerCondition).toBe(AutomationTrigger.Manual);
    expect(drafts[0].triggerTaskId).toBeNull();

    list.duplicate(drafts[0]);
    expect(drafts.map((d) => d.name)).toEqual([
      'Notify Red',
      'Notify Red (copy)',
    ]);
    expect(drafts[1].id).not.toBe('t-2');
  });

  /**
   * Verifies: Test Task is offered only to those who may test, is disabled while the task has errors, and hands the task up.
   * Interacts with: canTest, errors, the test output.
   * Data: canTest; a valid notification, then one without its text.
   */
  it('tests a valid task', async () => {
    const task = notify('t-1', 'Notify Blue');
    const { tested, fixture } = await renderList([task], { canTest: true });
    const user = userEvent.setup();

    await user.click(header(/1\. Notify Blue/));
    await user.click(screen.getByRole('button', { name: 'Test Task' }));
    expect(tested).toEqual([task]);

    task.actionParameters = {};
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Test Task' })).toBeDisabled();
  });

  /**
   * Verifies: read-only, there is no Add Task, Delete or drag handle, the fields are disabled, and Test Task is absent without the right to test.
   * Interacts with: canEdit, canTest.
   * Data: canEdit and canTest false; one notification.
   */
  it('is read-only without the right to edit', async () => {
    await renderList([notify('t-1', 'Notify Blue')], { canEdit: false });
    const user = userEvent.setup();

    expect(
      screen.queryByRole('button', { name: 'Add Task' }),
    ).not.toBeInTheDocument();
    await user.click(header(/1\. Notify Blue/));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Delete task 1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Test Task' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();
  });
});
