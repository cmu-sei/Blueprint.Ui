// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationRun,
  AutomationStatus,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';
import {
  AutomationTaskDraft,
  copyDrafts,
  draftFromTask,
  hasSecret,
  latestRunByTask,
  newDraft,
  overallStatus,
  taskErrors,
  toFields,
  triggerLoops,
  triggerSummary,
} from './automation-tasks';

const SSH: AutomationActionDefinition = {
  action: AutomationAction.CoreRemote,
  display: 'Run a remote command',
  parameters: [
    { key: 'Hosts', display: 'Hosts', required: true },
    { key: 'Port', display: 'Port', inputType: 'number', default: '22' },
    { key: 'At', display: 'Situation time', inputType: 'datetime' },
    { key: 'Password', display: 'Password', secret: true, required: true },
  ],
};
const VM: AutomationActionDefinition = {
  action: AutomationAction.VmHwPowerOn,
  display: 'Power on',
  requiresVm: true,
  parameters: [],
};

function ssh(
  overrides: Partial<AutomationTaskDraft> = {},
): AutomationTaskDraft {
  return {
    ...newDraft(SSH),
    name: 'Collect log',
    actionParameters: { Hosts: 'web-01', Port: '22' },
    secretChanges: { Password: 'hunter2' },
    ...overrides,
  };
}

describe('automation task drafts', () => {
  /**
   * Verifies: a new draft takes the action's defaults, is enabled, manual and runs once; a saved task's draft keeps its fields and names its stored secrets without any value.
   * Data: the SSH action with a Port default of 22; a saved task holding a Password.
   */
  it('starts from the action defaults or the saved task', () => {
    const fresh = newDraft(SSH);
    expect(fresh.actionParameters).toEqual({ Port: '22' });
    expect(fresh).toEqual(
      expect.objectContaining({
        enabled: true,
        iterations: 1,
        triggerCondition: AutomationTrigger.Manual,
      }),
    );

    const saved = draftFromTask({
      id: 't-1',
      name: 'Collect log',
      action: AutomationAction.CoreRemote,
      actionParameters: { Hosts: 'web-01' },
      secretParameterKeys: ['Password'],
      triggerCondition: AutomationTrigger.OnSuccess,
      triggerTaskId: 't-0',
    });
    expect(saved).toEqual(
      expect.objectContaining({
        id: 't-1',
        storedSecretKeys: ['Password'],
        secretChanges: {},
        triggerTaskId: 't-0',
      }),
    );
  });

  /**
   * Verifies: what a save sends carries the secrets this edit changed and no trigger task for a trigger that names none.
   * Data: an SSH draft setting its Password, at event time with a stale trigger task id.
   */
  it('toFields sends the score and whether participants run it, as numbers and booleans', () => {
    // the API sends numbers as strings
    const draft = draftFromTask({
      id: 't-1',
      score: '25' as unknown as number,
      userExecutable: true,
    });

    expect(toFields(draft)).toEqual(
      expect.objectContaining({ score: 25, userExecutable: true }),
    );
    expect(toFields(newDraft(SSH))).toEqual(
      expect.objectContaining({ score: 0, userExecutable: false }),
    );
  });

  it('toFields sends the secret changes and drops a stale trigger', () => {
    const fields = toFields(
      ssh({
        triggerCondition: AutomationTrigger.AtEventTime,
        triggerTaskId: 't-0',
      }),
    );

    expect(fields.secretParameters).toEqual({ Password: 'hunter2' });
    expect(fields.triggerTaskId).toBeNull();
    expect(fields).not.toHaveProperty('storedSecretKeys');
    expect(fields).not.toHaveProperty('secretChanges');
  });

  /**
   * Verifies: a secret is held when stored and not cleared, or set by this edit; clearing a stored one or leaving a new one empty is not.
   * Data: a stored Password, then cleared; a PrivateKey set; nothing stored or set.
   */
  it('hasSecret follows the stored secrets and this edit', () => {
    const stored = ssh({ storedSecretKeys: ['password'], secretChanges: {} });
    expect(hasSecret(stored, 'Password')).toBe(true);
    expect(
      hasSecret({ ...stored, secretChanges: { Password: '' } }, 'Password'),
    ).toBe(false);
    expect(
      hasSecret(ssh({ secretChanges: { PrivateKey: 'k' } }), 'PrivateKey'),
    ).toBe(true);
    expect(hasSecret(ssh({ secretChanges: {} }), 'Password')).toBe(false);
  });

  /**
   * Verifies: copies get new ids, a trigger within the copied tasks follows the copy, one on another event's task stays, and no stored secret or pending change is copied.
   * Data: a (manual) holding a Password, b on success of a, c on success of x, a task of another event.
   */
  it('copyDrafts keeps the chain within the copies', () => {
    const a = ssh({ id: 'a', storedSecretKeys: ['Password'] });
    const b = ssh({
      id: 'b',
      triggerCondition: AutomationTrigger.OnSuccess,
      triggerTaskId: 'a',
    });
    const c = ssh({
      id: 'c',
      triggerCondition: AutomationTrigger.OnSuccess,
      triggerTaskId: 'x',
    });

    const [ca, cb, cc] = copyDrafts([a, b, c]);

    expect([ca.id, cb.id, cc.id]).not.toContain('a');
    expect(cb.triggerTaskId).toBe(ca.id);
    expect(cc.triggerTaskId).toBe('x');
    expect(ca.storedSecretKeys).toEqual([]);
    expect(ca.secretChanges).toEqual({});
  });
});

describe('taskErrors', () => {
  const known = new Set(['t-0', 'a']);

  /**
   * Verifies: a complete task has no errors.
   * Data: an SSH task with its hosts and a new password.
   */
  it('accepts a complete task', () => {
    expect(taskErrors(ssh({ id: 'a' }), SSH, known)).toEqual([]);
  });

  /**
   * Verifies: each thing the API would refuse is named: no action, no name, a missing required parameter or secret, a VM action without a mask, a chained trigger without its task, on itself, or on a task no longer in the MSEL, iterations out of range and a negative delay.
   * Data: one draft per case.
   */
  it.each([
    {
      label: 'an unknown action',
      draft: ssh(),
      definition: undefined,
      error: 'Choose an action.',
    },
    {
      label: 'no name',
      draft: ssh({ name: ' ' }),
      definition: SSH,
      error: 'A name is required.',
    },
    {
      label: 'no hosts',
      draft: ssh({ actionParameters: {} }),
      definition: SSH,
      error: 'Hosts is required.',
    },
    {
      label: 'no password',
      draft: ssh({ secretChanges: {} }),
      definition: SSH,
      error: 'Password is required.',
    },
    {
      label: 'no VM mask',
      draft: { ...newDraft(VM), name: 'On' },
      definition: VM,
      error: 'A VM mask is required, since the action runs on VMs.',
    },
    {
      label: 'no trigger task',
      draft: ssh({ triggerCondition: AutomationTrigger.OnFailure }),
      definition: SSH,
      error: 'Choose the task that triggers it.',
    },
    {
      label: 'itself',
      draft: ssh({
        id: 'a',
        triggerCondition: AutomationTrigger.OnFailure,
        triggerTaskId: 'a',
      }),
      definition: SSH,
      error: 'A task cannot trigger itself.',
    },
    {
      label: 'a deleted task',
      draft: ssh({
        triggerCondition: AutomationTrigger.OnFailure,
        triggerTaskId: 'gone',
      }),
      definition: SSH,
      error: 'The task that triggers it is no longer in this MSEL.',
    },
    {
      label: 'no iterations',
      draft: ssh({ iterations: 0 }),
      definition: SSH,
      error: 'Iterations must be a whole number from 1 to 1000.',
    },
    {
      label: 'a negative delay',
      draft: ssh({ delaySeconds: -1 }),
      definition: SSH,
      error: 'The delay must be a whole number of seconds, from 0 to 7 days.',
    },
    {
      label: 'a fractional delay',
      draft: ssh({ delaySeconds: 0.5 }),
      definition: SSH,
      error: 'The delay must be a whole number of seconds, from 0 to 7 days.',
    },
    {
      label: 'an emptied delay',
      draft: ssh({ delaySeconds: null }),
      definition: SSH,
      error: 'The delay must be a whole number of seconds, from 0 to 7 days.',
    },
    {
      label: 'a port that is not a whole number',
      draft: ssh({ actionParameters: { Hosts: 'h', Port: '22.5' } }),
      definition: SSH,
      error: 'Port must be a whole number.',
    },
    {
      label: 'a time that is not a date',
      draft: ssh({ actionParameters: { Hosts: 'h', At: 'tomorrow' } }),
      definition: SSH,
      error: 'Situation time must be a date and time.',
    },
    {
      label: 'a day the month does not have',
      draft: ssh({
        actionParameters: { Hosts: 'h', At: '2026-02-30T10:00:00Z' },
      }),
      definition: SSH,
      error: 'Situation time must be a date and time.',
    },
    {
      label: 'a day the month does not have, written month first',
      draft: ssh({
        actionParameters: { Hosts: 'h', At: '02/30/2026 10:00:00' },
      }),
      definition: SSH,
      error: 'Situation time must be a date and time.',
    },
    {
      label: 'an offset beyond 14 hours',
      draft: ssh({
        actionParameters: { Hosts: 'h', At: '2026-03-01T10:00:00+14:30' },
      }),
      definition: SSH,
      error: 'Situation time must be a date and time.',
    },
    {
      label: 'an hour the day does not have',
      draft: ssh({
        actionParameters: { Hosts: 'h', At: '2026-02-28T24:00:00Z' },
      }),
      definition: SSH,
      error: 'Situation time must be a date and time.',
    },
  ])('names $label', ({ draft, definition, error }) => {
    expect(taskErrors(draft, definition, known)).toContain(error);
  });

  it.each([
    '2026-03-01T10:00:00Z',
    '2026-03-01T10:00',
    '2026-03-01 10:00:00.5+02:00',
    '2026-03-01',
    '3/1/2026 10:00',
    '02/28/2026',
    '2026-03-01T10:00:00+14:00',
    '2026-03-01T10:00:00-12:45',
  ])('takes the date and time %s', (at) => {
    expect(
      taskErrors(ssh({ actionParameters: { Hosts: 'h', At: at } }), SSH, known),
    ).not.toContain('Situation time must be a date and time.');
  });
});

describe('triggers', () => {
  /**
   * Verifies: a chain that comes back to its start is a loop, through another event's tasks too; a chain that ends is not.
   * Data: a after b after a; c after x, where x (another event) is after c; d after a.
   */
  it('triggerLoops finds the tasks whose triggers lead back to them', () => {
    const drafts = [
      ssh({
        id: 'a',
        name: 'A',
        triggerCondition: AutomationTrigger.OnSuccess,
        triggerTaskId: 'b',
      }),
      ssh({
        id: 'b',
        name: 'B',
        triggerCondition: AutomationTrigger.OnSuccess,
        triggerTaskId: 'a',
      }),
      ssh({
        id: 'c',
        name: 'C',
        triggerCondition: AutomationTrigger.OnCompletion,
        triggerTaskId: 'x',
      }),
      ssh({
        id: 'd',
        name: 'D',
        triggerCondition: AutomationTrigger.OnCompletion,
        triggerTaskId: 'e',
      }),
    ];

    expect(
      triggerLoops(
        drafts,
        new Map([
          ['x', 'c'],
          ['e', null],
        ]),
      ),
    ).toEqual(['A', 'B', 'C']);
  });

  /**
   * Verifies: a task that only leads into a loop of other tasks, kept from older data, is not in that loop.
   * Data: n after y, where y and z (another event) trigger each other.
   */
  it('triggerLoops leaves a task that only leads into a loop', () => {
    const drafts = [
      ssh({
        id: 'n',
        name: 'N',
        triggerCondition: AutomationTrigger.OnSuccess,
        triggerTaskId: 'y',
      }),
    ];

    expect(
      triggerLoops(
        drafts,
        new Map([
          ['y', 'z'],
          ['z', 'y'],
        ]),
      ),
    ).toEqual([]);
  });

  /**
   * Verifies: a trigger reads as its label, with the task it names when it names one.
   * Data: Manual; At event time; On success of "Power on".
   */
  it('triggerSummary names the trigger and its task', () => {
    expect(triggerSummary(AutomationTrigger.Manual, 'ignored')).toBe('Manual');
    expect(triggerSummary(AutomationTrigger.AtEventTime, undefined)).toBe(
      'At event time',
    );
    expect(triggerSummary(AutomationTrigger.OnSuccess, 'Power on')).toBe(
      'On success of Power on',
    );
  });
});

describe('run outcomes', () => {
  const run = (
    id: string,
    taskId: string,
    status: AutomationStatus,
  ): AutomationRun => ({
    id,
    automationTaskId: taskId,
    status,
  });

  /**
   * Verifies: from runs newest first, each task's newest run is kept.
   * Data: t-1 failed then (older) succeeded; t-2 running.
   */
  it('latestRunByTask keeps each task newest run', () => {
    const latest = latestRunByTask([
      run('r3', 't-1', AutomationStatus.Failed),
      run('r2', 't-2', AutomationStatus.Running),
      run('r1', 't-1', AutomationStatus.Succeeded),
    ]);

    expect(latest.get('t-1').id).toBe('r3');
    expect(latest.get('t-2').id).toBe('r2');
  });

  /**
   * Verifies: an event's tasks together read Failed when any newest run failed, expired or erred, Running while one runs, Succeeded only when every one succeeded, and nothing when none ran or some never did.
   * Data: the statuses of two tasks per case.
   */
  it.each([
    {
      statuses: [AutomationStatus.Succeeded, AutomationStatus.Expired],
      expected: AutomationStatus.Failed,
    },
    {
      statuses: [AutomationStatus.Succeeded, AutomationStatus.Queued],
      expected: AutomationStatus.Running,
    },
    {
      statuses: [AutomationStatus.Succeeded, AutomationStatus.Succeeded],
      expected: AutomationStatus.Succeeded,
    },
    { statuses: [AutomationStatus.Succeeded, undefined], expected: undefined },
    { statuses: [undefined, undefined], expected: undefined },
  ])('overallStatus of $statuses is $expected', ({ statuses, expected }) => {
    const latest = new Map<string, AutomationRun>();
    statuses.forEach(
      (s, i) => s && latest.set(`t-${i}`, run(`r-${i}`, `t-${i}`, s)),
    );

    expect(overallStatus(['t-0', 't-1'], latest)).toBe(expected);
  });
});
