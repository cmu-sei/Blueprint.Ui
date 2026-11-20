// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { v4 as uuidv4 } from 'uuid';
import {
  AutomationAction,
  AutomationActionDefinition,
  AutomationIterationTermination,
  AutomationRun,
  AutomationStatus,
  AutomationTask,
  AutomationTaskFields,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';

/**
 * An automation task while its scenario event is edited. The API never sends a secret back, only the names of those
 * it holds; secretChanges are what this edit sets (a value) or clears (an empty string), and a secret it does not
 * name is left as it is.
 */
export interface AutomationTaskDraft extends AutomationTaskFields {
  id: string;
  storedSecretKeys: string[];
  secretChanges: Record<string, string>;
}

export const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: AutomationTrigger.Manual, label: 'Manual' },
  { value: AutomationTrigger.AtEventTime, label: 'At event time' },
  { value: AutomationTrigger.OnSuccess, label: 'On success of' },
  { value: AutomationTrigger.OnFailure, label: 'On failure of' },
  { value: AutomationTrigger.OnCompletion, label: 'On completion of' },
  { value: AutomationTrigger.OnExpiration, label: 'On expiration of' },
];

export const ITERATION_TERMINATIONS: {
  value: AutomationIterationTermination;
  label: string;
}[] = [
  { value: AutomationIterationTermination.IterationCount, label: 'Count' },
  {
    value: AutomationIterationTermination.UntilSuccess,
    label: 'Until success',
  },
  {
    value: AutomationIterationTermination.UntilFailure,
    label: 'Until failure',
  },
];

/** Whether the trigger is another task's outcome, and so names the task. */
export function isChained(trigger: AutomationTrigger | undefined): boolean {
  return (
    !!trigger &&
    trigger !== AutomationTrigger.Manual &&
    trigger !== AutomationTrigger.AtEventTime
  );
}

export function draftFromTask(task: AutomationTask): AutomationTaskDraft {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    action: task.action,
    actionParameters: { ...(task.actionParameters ?? {}) },
    vmMask: task.vmMask,
    expectedOutput: task.expectedOutput,
    expirationSeconds: task.expirationSeconds,
    delaySeconds: task.delaySeconds,
    intervalSeconds: task.intervalSeconds,
    iterations: task.iterations,
    iterationTermination: task.iterationTermination,
    triggerCondition: task.triggerCondition,
    triggerTaskId: task.triggerTaskId,
    enabled: task.enabled,
    repeatable: task.repeatable,
    score: Number(task.score ?? 0),
    userExecutable: !!task.userExecutable,
    storedSecretKeys: [...(task.secretParameterKeys ?? [])],
    secretChanges: {},
  };
}

export function newDraft(
  definition?: AutomationActionDefinition,
): AutomationTaskDraft {
  const draft: AutomationTaskDraft = {
    id: uuidv4(),
    name: '',
    action: definition?.action ?? AutomationAction.PlayerNotification,
    actionParameters: {},
    expirationSeconds: 120,
    delaySeconds: 0,
    intervalSeconds: 0,
    iterations: 1,
    iterationTermination: AutomationIterationTermination.IterationCount,
    triggerCondition: AutomationTrigger.Manual,
    triggerTaskId: null,
    enabled: true,
    repeatable: false,
    score: 0,
    userExecutable: false,
    storedSecretKeys: [],
    secretChanges: {},
  };
  applyDefaults(draft, definition);
  return draft;
}

/** Fills the parameters the action has a default for and the draft has no value for. */
export function applyDefaults(
  draft: AutomationTaskDraft,
  definition: AutomationActionDefinition | undefined,
) {
  (definition?.parameters ?? [])
    .filter((p) => !p.secret && p.default != null)
    .forEach((p) => {
      if (draft.actionParameters[p.key] == null) {
        draft.actionParameters[p.key] = p.default;
      }
    });
}

/**
 * Copies of the drafts with new ids, for a copied scenario event. A trigger on one of the copied tasks follows the
 * copy; a trigger on a task of another event stays. Secrets are never copied: the API does not send them.
 */
export function copyDrafts(
  drafts: AutomationTaskDraft[],
): AutomationTaskDraft[] {
  const ids = new Map(drafts.map((d) => [d.id, uuidv4()]));
  return drafts.map((d) => ({
    ...d,
    id: ids.get(d.id),
    actionParameters: { ...d.actionParameters },
    triggerTaskId: d.triggerTaskId
      ? (ids.get(d.triggerTaskId) ?? d.triggerTaskId)
      : null,
    storedSecretKeys: [],
    secretChanges: {},
  }));
}

/** What a save sends: the fields, with the secrets this edit changes. */
export function toFields(draft: AutomationTaskDraft): AutomationTaskFields {
  return {
    id: draft.id,
    name: draft.name,
    description: draft.description,
    action: draft.action,
    actionParameters: { ...(draft.actionParameters ?? {}) },
    secretParameters: { ...draft.secretChanges },
    vmMask: draft.vmMask,
    expectedOutput: draft.expectedOutput,
    expirationSeconds: draft.expirationSeconds,
    delaySeconds: draft.delaySeconds,
    intervalSeconds: draft.intervalSeconds,
    iterations: draft.iterations,
    iterationTermination: draft.iterationTermination,
    triggerCondition: draft.triggerCondition,
    triggerTaskId: isChained(draft.triggerCondition)
      ? draft.triggerTaskId
      : null,
    enabled: draft.enabled,
    repeatable: draft.repeatable,
    score: draft.score ?? 0,
    userExecutable: !!draft.userExecutable,
  };
}

/** Whether the draft will hold the secret after a save: stored and not cleared, or set by this edit. */
export function hasSecret(draft: AutomationTaskDraft, key: string): boolean {
  const change = draft.secretChanges[key];
  if (change !== undefined) {
    return change !== '';
  }
  return draft.storedSecretKeys.some(
    (k) => k.toLowerCase() === key.toLowerCase(),
  );
}

/**
 * What is wrong with a draft, as the API would say before it refuses the save. Checked here so the dialog, which
 * closes on Save, keeps the author's work.
 */
export function taskErrors(
  draft: AutomationTaskDraft,
  definition: AutomationActionDefinition | undefined,
  knownTaskIds: Set<string>,
): string[] {
  const errors: string[] = [];
  if (!definition) {
    return ['Choose an action.'];
  }
  if (!draft.name?.trim()) {
    errors.push('A name is required.');
  }
  (definition.parameters ?? [])
    .filter((p) => p.required)
    .forEach((p) => {
      const present = p.secret
        ? hasSecret(draft, p.key)
        : !!`${draft.actionParameters?.[p.key] ?? ''}`.trim();
      if (!present) {
        errors.push(`${p.display || p.key} is required.`);
      }
    });
  // the values the API would refuse, so the dialog is not closed on a save that fails
  (definition.parameters ?? [])
    .filter((p) => !p.secret)
    .forEach((p) => {
      const value = `${draft.actionParameters?.[p.key] ?? ''}`.trim();
      if (!value) return;
      const name = p.display || p.key;
      if (p.inputType === 'number' && !/^-?\d+$/.test(value)) {
        errors.push(`${name} must be a whole number.`);
      } else if (
        p.inputType === 'datetime' &&
        Number.isNaN(Date.parse(value))
      ) {
        errors.push(`${name} must be a date and time.`);
      } else if (p.inputType === 'checkbox' && !/^(true|false)$/i.test(value)) {
        errors.push(`${name} must be true or false.`);
      }
    });
  if (definition.requiresVm && !draft.vmMask?.trim()) {
    errors.push('A VM mask is required, since the action runs on VMs.');
  }
  if (isChained(draft.triggerCondition)) {
    if (!draft.triggerTaskId) {
      errors.push('Choose the task that triggers it.');
    } else if (draft.triggerTaskId === draft.id) {
      errors.push('A task cannot trigger itself.');
    } else if (!knownTaskIds.has(draft.triggerTaskId)) {
      errors.push('The task that triggers it is no longer in this MSEL.');
    }
  }
  // whole numbers, as the API takes them: an emptied field is not 0
  const whole = (value: unknown) =>
    value !== null && value !== '' && Number.isInteger(+value);
  if (!(
    whole(draft.iterations) &&
    draft.iterations >= 1 &&
    draft.iterations <= 1000
  )) {
    errors.push('Iterations must be a whole number from 1 to 1000.');
  }
  (
    [
      ['The expiration', draft.expirationSeconds],
      ['The delay', draft.delaySeconds],
      ['The interval', draft.intervalSeconds],
    ] as [string, unknown][]
  ).forEach(([name, value]) => {
    if (!(whole(value) && +value >= 0 && +value <= 7 * 24 * 3600)) {
      errors.push(
        `${name} must be a whole number of seconds, from 0 to 7 days.`,
      );
    }
  });
  const score = draft.score ?? 0;
  if (!(whole(score) && +score >= 0 && +score <= 100000)) {
    errors.push('The score must be a whole number from 0 to 100000.');
  }
  return errors;
}

/**
 * The drafts' triggers that lead back to where they started, which the API refuses: a loop would run forever.
 * otherTriggers are the triggers of the MSEL's tasks on other events.
 */
export function triggerLoops(
  drafts: AutomationTaskDraft[],
  otherTriggers: Map<string, string | null>,
): string[] {
  const triggers = new Map(otherTriggers);
  drafts.forEach((d) =>
    triggers.set(d.id, isChained(d.triggerCondition) ? d.triggerTaskId : null),
  );
  return drafts
    .filter((d) => {
      // only a task its triggers lead back to is in a loop: one that leads into a loop of others is not
      const seen = new Set<string>();
      for (
        let at = triggers.get(d.id);
        at && !seen.has(at);
        at = triggers.get(at)
      ) {
        if (at === d.id) return true;
        seen.add(at);
      }
      return false;
    })
    .map((d) => d.name || 'A task');
}

/** "On success of Power on", or "Manual". */
export function triggerSummary(
  trigger: AutomationTrigger | undefined,
  triggerTaskName: string | undefined,
): string {
  const label = TRIGGERS.find((t) => t.value === trigger)?.label ?? 'Manual';
  return isChained(trigger) ? `${label} ${triggerTaskName ?? '?'}` : label;
}

export const FINAL_STATUSES: AutomationStatus[] = [
  AutomationStatus.Succeeded,
  AutomationStatus.Failed,
  AutomationStatus.Expired,
  AutomationStatus.Cancelled,
  AutomationStatus.Error,
  AutomationStatus.Skipped,
];

export function isFinal(status: AutomationStatus | undefined): boolean {
  return !!status && FINAL_STATUSES.includes(status);
}

/** The newest run of each task, from runs sorted newest first. */
export function latestRunByTask(
  runs: AutomationRun[],
): Map<string, AutomationRun> {
  const latest = new Map<string, AutomationRun>();
  runs.forEach((r) => {
    if (r.automationTaskId && !latest.has(r.automationTaskId)) {
      latest.set(r.automationTaskId, r);
    }
  });
  return latest;
}

/**
 * One status for a group of tasks: Failed when any latest run did not succeed, Succeeded when every task's latest run
 * did, Running while one runs, and undefined when none ran.
 */
export function overallStatus(
  taskIds: string[],
  latest: Map<string, AutomationRun>,
): AutomationStatus | undefined {
  const statuses = taskIds.map((id) => latest.get(id)?.status);
  if (statuses.every((s) => !s)) return undefined;
  if (
    statuses.some(
      (s) =>
        s === AutomationStatus.Failed ||
        s === AutomationStatus.Expired ||
        s === AutomationStatus.Error,
    )
  ) {
    return AutomationStatus.Failed;
  }
  if (
    statuses.some(
      (s) =>
        s === AutomationStatus.Running ||
        s === AutomationStatus.Queued ||
        s === AutomationStatus.Pending,
    )
  ) {
    return AutomationStatus.Running;
  }
  return statuses.every((s) => s === AutomationStatus.Succeeded)
    ? AutomationStatus.Succeeded
    : undefined;
}
