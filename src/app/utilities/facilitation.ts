// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AutomationRun,
  AutomationStatus,
  AutomationTask,
  AutomationTrigger,
  Move,
  MselExecution,
} from 'src/app/generated/blueprint.api';
import { isFinal } from './automation-tasks';

/**
 * What a deployment's runs say about its tasks, by task: each task's runs newest first, and whether a task has
 * succeeded, which a task that is not repeatable runs only until it does.
 */
export class DeploymentRuns {
  readonly byTask = new Map<string, AutomationRun[]>();
  private readonly succeeded = new Set<string>();

  /** runs: the MSEL's exercise runs, newest first; only the deployment's count. */
  constructor(runs: AutomationRun[], deploymentId: string | null | undefined) {
    runs
      .filter((r) => !!deploymentId && r.deploymentId === deploymentId)
      .forEach((r) => {
        if (!r.automationTaskId) return;
        this.byTask.set(r.automationTaskId, [
          ...(this.byTask.get(r.automationTaskId) ?? []),
          r,
        ]);
        if (r.status === AutomationStatus.Succeeded) {
          this.succeeded.add(r.automationTaskId);
        }
      });
  }

  latest(taskId: string): AutomationRun | undefined {
    return this.byTask.get(taskId)?.[0];
  }

  hasSucceeded(taskId: string): boolean {
    return this.succeeded.has(taskId);
  }
}

/** Why a task cannot be run by hand now, as the API would refuse it; empty when it can. */
export function cannotRun(
  task: AutomationTask,
  runs: DeploymentRuns,
  canAct: boolean,
): string {
  if (!canAct)
    return 'Only a Facilitator or Owner of the deployed MSEL can run tasks.';
  if (!task.enabled) return 'The task is disabled.';
  const latest = runs.latest(task.id);
  if (latest && !isFinal(latest.status)) return 'The task is already running.';
  if (!task.repeatable && runs.hasSucceeded(task.id)) {
    return 'The task is not repeatable, and has already succeeded.';
  }
  return '';
}

/** Why a run cannot be run again now; empty when it can. */
export function cannotRerun(
  run: AutomationRun,
  task: AutomationTask | undefined,
  runs: DeploymentRuns,
  canAct: boolean,
): string {
  if (!canAct)
    return 'Only a Facilitator or Owner of the deployed MSEL can run tasks.';
  if (!task) return 'The task this run ran has been deleted.';
  if (!isFinal(run.status)) return 'The run has not ended.';
  if (!task.repeatable && runs.hasSucceeded(task.id)) {
    return 'The task is not repeatable, and has already succeeded.';
  }
  return '';
}

export function canCancel(
  run: AutomationRun | undefined,
  canAct: boolean,
): boolean {
  return canAct && !!run && !isFinal(run.status) && !run.cancelRequested;
}

/** One status and a few words for an event's tasks, as its row shows them. */
export function eventAutomationSummary(
  tasks: AutomationTask[],
  runs: DeploymentRuns,
): { status: AutomationStatus | undefined; label: string } {
  const statuses = tasks.map((t) => runs.latest(t.id)?.status);
  const count = (...these: AutomationStatus[]) =>
    statuses.filter((s) => !!s && these.includes(s)).length;
  const total = tasks.length;
  const failed = count(
    AutomationStatus.Failed,
    AutomationStatus.Expired,
    AutomationStatus.Error,
  );
  if (failed > 0) {
    return {
      status: AutomationStatus.Failed,
      label: `${failed} of ${total} failed`,
    };
  }
  const running = count(AutomationStatus.Running, AutomationStatus.Queued);
  if (running > 0) {
    return { status: AutomationStatus.Running, label: `${running} running` };
  }
  const waiting = count(AutomationStatus.Pending);
  if (waiting > 0) {
    return { status: AutomationStatus.Pending, label: `${waiting} waiting` };
  }
  const succeeded = count(AutomationStatus.Succeeded);
  if (succeeded === total && total > 0) {
    return { status: AutomationStatus.Succeeded, label: `${total} succeeded` };
  }
  if (succeeded > 0) {
    return {
      status: AutomationStatus.Succeeded,
      label: `${succeeded} of ${total} succeeded`,
    };
  }
  return { status: undefined, label: `${total} not run` };
}

/** The counts the Facilitator View's summary shows. */
export function runCounts(tasks: AutomationTask[], runs: DeploymentRuns) {
  const statuses = tasks.map((t) => runs.latest(t.id)?.status);
  const has = (...these: AutomationStatus[]) =>
    statuses.filter((s) => !!s && these.includes(s)).length;
  return {
    failed: has(
      AutomationStatus.Failed,
      AutomationStatus.Expired,
      AutomationStatus.Error,
    ),
    running: has(AutomationStatus.Running, AutomationStatus.Queued),
    waiting: has(AutomationStatus.Pending),
  };
}

export type MoveState = 'completed' | 'current' | 'upcoming';

/** Where a move is in the deployed exercise; every move is upcoming before the first starts. */
export function moveState(
  moveNumber: number,
  execution: MselExecution | undefined,
): MoveState {
  const current = execution?.currentMoveNumber;
  if (current == null) return 'upcoming';
  if (moveNumber < current) return 'completed';
  return moveNumber === current ? 'current' : 'upcoming';
}

export function isCurrentGroup(
  moveNumber: number,
  groupNumber: number,
  execution: MselExecution | undefined,
): boolean {
  return (
    execution?.currentMoveNumber === moveNumber &&
    execution?.currentGroupNumber === groupNumber
  );
}

/** The next move to start: the first after the current one, or the first when none has started. */
export function nextMove(
  moves: Move[],
  execution: MselExecution | undefined,
): Move | undefined {
  const current = execution?.currentMoveNumber;
  return [...moves]
    .sort((a, b) => a.moveNumber - b.moveNumber)
    .find((m) => current == null || m.moveNumber > current);
}

/** "+01:05:00" from the MSEL's start. */
export function formatOffset(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const total = Math.abs(Math.round(seconds));
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${sign}${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** "in 12 min", "3 min ago", "now", from a time and the present. */
export function relativeTime(at: Date, now: Date): string {
  const minutes = Math.round((at.valueOf() - now.valueOf()) / 60000);
  if (minutes === 0) return 'now';
  const amount =
    Math.abs(minutes) >= 120
      ? `${Math.round(Math.abs(minutes) / 60)} h`
      : `${Math.abs(minutes)} min`;
  return minutes > 0 ? `in ${amount}` : `${amount} ago`;
}

/**
 * The tasks a facilitator is offered to run when a move or group starts: the enabled manual tasks of its events, in
 * event and list order. They run one after another, as the Steamfitter push ran a group's tasks.
 */
export function manualTasksOf(
  eventIds: string[],
  tasksByEvent: Map<string, AutomationTask[]>,
): AutomationTask[] {
  return eventIds.flatMap((id) =>
    (tasksByEvent.get(id) ?? []).filter(
      (t) => t.enabled && t.triggerCondition === AutomationTrigger.Manual,
    ),
  );
}
