// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  AutomationRun,
  AutomationStatus,
  AutomationTask,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';
import {
  DeploymentRuns,
  canCancel,
  cannotRerun,
  cannotRun,
  eventAutomationSummary,
  formatOffset,
  manualTasksOf,
  moveState,
  nextMove,
  relativeTime,
  runCounts,
  scoreTasks,
} from './facilitation';

const task = (
  id: string,
  extra: Partial<AutomationTask> = {},
): AutomationTask => ({
  id,
  name: id,
  enabled: true,
  repeatable: false,
  triggerCondition: AutomationTrigger.Manual,
  ...extra,
});
const run = (
  id: string,
  taskId: string,
  status: AutomationStatus,
  deploymentId = 'dep-2',
): AutomationRun => ({ id, automationTaskId: taskId, status, deploymentId });

describe('DeploymentRuns', () => {
  /**
   * Verifies: only the current deployment's runs count; each task's newest run is the first given; a task that succeeded once is known to have, even if a later run failed.
   * Data: runs newest first: t-1 failed then succeeded in dep-2, t-2 succeeded in the earlier dep-1.
   */
  it('keeps the deployment runs by task', () => {
    const runs = new DeploymentRuns(
      [
        run('r3', 't-1', AutomationStatus.Failed),
        run('r2', 't-1', AutomationStatus.Succeeded),
        run('r1', 't-2', AutomationStatus.Succeeded, 'dep-1'),
      ],
      'dep-2',
    );

    expect(runs.latest('t-1').id).toBe('r3');
    expect(runs.hasSucceeded('t-1')).toBe(true);
    expect(runs.latest('t-2')).toBeUndefined();
    expect(
      new DeploymentRuns([run('r', 't', AutomationStatus.Failed)], null).latest(
        't',
      ),
    ).toBeUndefined();
  });
});

describe('what a facilitator may do', () => {
  const runs = new DeploymentRuns(
    [
      run('running', 't-run', AutomationStatus.Running),
      run('done', 't-done', AutomationStatus.Succeeded),
      run('failed', 't-failed', AutomationStatus.Failed),
    ],
    'dep-2',
  );

  /**
   * Verifies: a task can be run unless the user cannot act, it is disabled, it is running, or it is not repeatable and already succeeded; a repeatable one runs again.
   * Data: one task per case.
   */
  it.each([
    {
      label: 'a task that has not run',
      t: task('t-new'),
      canAct: true,
      reason: '',
    },
    {
      label: 'without the right to act',
      t: task('t-new'),
      canAct: false,
      reason: 'Only a Facilitator or Owner of the deployed MSEL can run tasks.',
    },
    {
      label: 'a disabled task',
      t: task('t-new', { enabled: false }),
      canAct: true,
      reason: 'The task is disabled.',
    },
    {
      label: 'a running task',
      t: task('t-run'),
      canAct: true,
      reason: 'The task is already running.',
    },
    {
      label: 'a task that succeeded',
      t: task('t-done'),
      canAct: true,
      reason: 'The task is not repeatable, and has already succeeded.',
    },
    {
      label: 'a repeatable task that succeeded',
      t: task('t-done', { repeatable: true }),
      canAct: true,
      reason: '',
    },
  ])('cannotRun for $label', ({ t, canAct, reason }) => {
    expect(cannotRun(t, runs, canAct)).toBe(reason);
  });

  /**
   * Verifies: a run can be run again once it ended, if its task still exists and may run again; only a run that has not ended and is not being cancelled can be cancelled.
   * Data: the failed, running and succeeded runs above.
   */
  it('cannotRerun and canCancel follow the run', () => {
    const failed = runs.latest('t-failed');
    const running = runs.latest('t-run');

    expect(cannotRerun(failed, task('t-failed'), runs, true)).toBe('');
    expect(cannotRerun(running, task('t-run'), runs, true)).toBe(
      'The run has not ended.',
    );
    expect(cannotRerun(failed, undefined, runs, true)).toBe(
      'The task this run ran has been deleted.',
    );
    expect(cannotRerun(runs.latest('t-done'), task('t-done'), runs, true)).toBe(
      'The task is not repeatable, and has already succeeded.',
    );
    expect(canCancel(running, true)).toBe(true);
    expect(canCancel({ ...running, cancelRequested: true }, true)).toBe(false);
    expect(canCancel(failed, true)).toBe(false);
    expect(canCancel(running, false)).toBe(false);
  });
});

describe('summaries', () => {
  /**
   * Verifies: an event's tasks read failed first, then running, waiting, all or some succeeded, and not run; the counts take each task's newest run.
   * Data: the newest statuses of three tasks per case.
   */
  it.each<{
    statuses: (AutomationStatus | undefined)[];
    label: string;
    status: AutomationStatus | undefined;
  }>([
    {
      statuses: [
        AutomationStatus.Succeeded,
        AutomationStatus.Expired,
        undefined,
      ],
      label: '1 of 3 failed',
      status: AutomationStatus.Failed,
    },
    {
      statuses: [AutomationStatus.Queued, AutomationStatus.Running, undefined],
      label: '2 running',
      status: AutomationStatus.Running,
    },
    {
      statuses: [AutomationStatus.Pending, undefined, undefined],
      label: '1 waiting',
      status: AutomationStatus.Pending,
    },
    {
      statuses: [
        AutomationStatus.Succeeded,
        AutomationStatus.Succeeded,
        AutomationStatus.Succeeded,
      ],
      label: '3 succeeded',
      status: AutomationStatus.Succeeded,
    },
    {
      statuses: [AutomationStatus.Succeeded, undefined, undefined],
      label: '1 of 3 succeeded',
      status: AutomationStatus.Succeeded,
    },
    {
      statuses: [undefined, undefined, undefined],
      label: '3 not run',
      status: undefined,
    },
  ])('$label', ({ statuses, label, status }) => {
    const tasks = statuses.map((_, i) => task(`t-${i}`));
    const runs = new DeploymentRuns(
      statuses.flatMap((s, i) => (s ? [run(`r-${i}`, `t-${i}`, s)] : [])),
      'dep-2',
    );

    expect(eventAutomationSummary(tasks, runs)).toEqual({ status, label });
  });

  /**
   * Verifies: the Facilitator View's counts of failed, running and waiting tasks.
   * Data: a failed, an erred, a queued and a pending task.
   */
  it('runCounts counts the newest runs', () => {
    const runs = new DeploymentRuns(
      [
        run('a', 't-a', AutomationStatus.Failed),
        run('b', 't-b', AutomationStatus.Error),
        run('c', 't-c', AutomationStatus.Queued),
        run('d', 't-d', AutomationStatus.Pending),
      ],
      'dep-2',
    );

    expect(
      runCounts(
        ['t-a', 't-b', 't-c', 't-d'].map((id) => task(id)),
        runs,
      ),
    ).toEqual({
      failed: 2,
      running: 1,
      waiting: 1,
    });
  });
});

describe('the exercise timeline', () => {
  const moves = [
    { moveNumber: 2, deltaSeconds: 3600 },
    { moveNumber: 0, deltaSeconds: 0 },
    { moveNumber: 1, deltaSeconds: 900 },
  ];

  /**
   * Verifies: a move is completed before the current one, current, or upcoming; before any move starts every move is upcoming and the first is next; after the last there is none.
   * Data: moves 0, 1 and 2; the current move unset, 1, then 2.
   */
  it('places the moves around the current one', () => {
    expect(moveState(0, { currentMoveNumber: 1 })).toBe('completed');
    expect(moveState(1, { currentMoveNumber: 1 })).toBe('current');
    expect(moveState(2, { currentMoveNumber: 1 })).toBe('upcoming');
    expect(moveState(0, {})).toBe('upcoming');
    expect(nextMove(moves, {}).moveNumber).toBe(0);
    expect(nextMove(moves, { currentMoveNumber: 1 }).moveNumber).toBe(2);
    expect(nextMove(moves, { currentMoveNumber: 2 })).toBeUndefined();
  });

  /**
   * Verifies: offsets read +hh:mm:ss, and times read relative to now in minutes, or hours when far off.
   * Data: 3725 s and -60 s; times 12 minutes ahead, 3 minutes ago, 3 hours ahead and now.
   */
  it('formats offsets and relative times', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const at = (minutes: number) => new Date(now.valueOf() + minutes * 60000);

    expect(formatOffset(3725)).toBe('+01:02:05');
    expect(formatOffset(-60)).toBe('-00:01:00');
    expect(relativeTime(at(12), now)).toBe('in 12 min');
    expect(relativeTime(at(-3), now)).toBe('3 min ago');
    expect(relativeTime(at(180), now)).toBe('in 3 h');
    expect(relativeTime(now, now)).toBe('now');
  });

  /**
   * Verifies: starting a move or group offers the enabled manual tasks of its events, in event and list order.
   * Data: se-1 with a manual task, a disabled one and one at event time; se-2 with a manual task.
   */
  it('manualTasksOf offers the enabled manual tasks', () => {
    const tasksByEvent = new Map([
      [
        'se-1',
        [
          task('a'),
          task('b', { enabled: false }),
          task('c', { triggerCondition: AutomationTrigger.AtEventTime }),
        ],
      ],
      ['se-2', [task('d')]],
    ]);

    expect(
      manualTasksOf(['se-2', 'se-1'], tasksByEvent).map((t) => t.id),
    ).toEqual(['d', 'a']);
  });
});

describe('scoreTasks', () => {
  const scored = (
    id: string,
    score: number,
    trigger: AutomationTrigger = AutomationTrigger.Manual,
    after?: string,
  ): AutomationTask => ({
    id,
    name: id,
    enabled: true,
    score,
    triggerCondition: trigger,
    triggerTaskId: after,
  });

  /**
   * Verifies: a task's possible points take the better of its success and failure branches, with what follows on completion, unless what follows on expiration is more; the same case the API's AutomationScoringTests pins.
   * Data: root 10; on success 20 (then 4 more on its success), on failure 5, on completion 3, on expiration 15.
   */
  it('takes the best way each run can go', () => {
    const tasks = [
      scored('root', 10),
      scored('success', 20, AutomationTrigger.OnSuccess, 'root'),
      scored('failure', 5, AutomationTrigger.OnFailure, 'root'),
      scored('completion', 3, AutomationTrigger.OnCompletion, 'root'),
      scored('expiration', 15, AutomationTrigger.OnExpiration, 'root'),
      scored('afterSuccess', 4, AutomationTrigger.OnSuccess, 'success'),
    ];

    const result = scoreTasks(tasks, new DeploymentRuns([], 'dep-2'));

    expect(result.tasks.get('root').totalScore).toBe(37);
    expect(result.tasks.get('success').totalScore).toBe(24);
    expect(result).toEqual(
      expect.objectContaining({ score: 37, scoreEarned: 0 }),
    );
  });

  /**
   * Verifies: a task earns its points when its newest run in the deployment succeeded, and the earned total adds what the tasks it triggers earned; a disabled task offers none of its own; points sent as strings count as numbers.
   * Data: root 10 then on success 20, both succeeded; 7 failed; a disabled 9; root's points sent as "10".
   */
  it('earns the points of the tasks that succeeded', () => {
    const tasks = [
      { ...scored('root', 0), score: '10' as unknown as number },
      scored('success', 20, AutomationTrigger.OnSuccess, 'root'),
      scored('failed', 7),
      { ...scored('off', 9), enabled: false },
    ];
    const runs = new DeploymentRuns(
      [
        run('a', 'root', AutomationStatus.Succeeded),
        run('b', 'success', AutomationStatus.Succeeded),
        run('c', 'failed', AutomationStatus.Failed),
      ],
      'dep-2',
    );

    const result = scoreTasks(tasks, runs);

    expect(result).toEqual(
      expect.objectContaining({ score: 37, scoreEarned: 30 }),
    );
    expect(result.tasks.get('root').totalScoreEarned).toBe(30);
    expect(result.tasks.get('off').totalScore).toBe(0);
  });

  /**
   * Verifies: a loop, which the API refuses, counts each task once rather than recursing forever.
   * Data: a after b after a, one point each.
   */
  it('copes with a loop', () => {
    const result = scoreTasks(
      [
        scored('a', 1, AutomationTrigger.OnSuccess, 'b'),
        scored('b', 1, AutomationTrigger.OnSuccess, 'a'),
      ],
      new DeploymentRuns([], 'dep-2'),
    );

    expect(result.score).toBe(0);
    expect(result.tasks.get('a').totalScore).toBe(2);
  });
});
