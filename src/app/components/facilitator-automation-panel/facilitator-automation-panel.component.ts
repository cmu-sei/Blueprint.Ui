// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { take } from 'rxjs/operators';
import { AutomationRun, AutomationTask } from 'src/app/generated/blueprint.api';
import { AutomationRunDataService } from 'src/app/data/automation-run/automation-run-data.service';
import { isFinal, triggerSummary } from 'src/app/utilities/automation-tasks';
import {
  DeploymentRuns,
  TaskScore,
  canCancel,
  cannotRerun,
  cannotRun,
} from 'src/app/utilities/facilitation';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';

/**
 * A scenario event's automation tasks on the Facilitator View: how each was triggered, how its newest run in this
 * deployment went, and the actions a facilitator has on it.
 */
@Component({
  selector: 'app-facilitator-automation-panel',
  imports: [
    AutomationStatusChipComponent,
    DatePipe,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
  ],
  templateUrl: './facilitator-automation-panel.component.html',
  styleUrls: ['./facilitator-automation-panel.component.scss'],
})
export class FacilitatorAutomationPanelComponent {
  private runData = inject(AutomationRunDataService);

  readonly tasks = input<AutomationTask[]>([]);
  readonly runs = input<DeploymentRuns>(new DeploymentRuns([], null));
  readonly canAct = input(false);
  /** The names of the MSEL's tasks, by id, for naming a trigger. */
  readonly taskNames = input<Map<string, string>>(new Map());
  /** Each task's points, by id. */
  readonly scores = input<Map<string, TaskScore>>(new Map());
  readonly history = output<AutomationTask>();

  /** Whether any of the event's tasks offers points, so the panel has a Score column. */
  hasScores(): boolean {
    return this.tasks().some(
      (t) => (this.scores().get(t.id)?.totalScore ?? 0) > 0,
    );
  }

  score(task: AutomationTask): TaskScore | undefined {
    return this.scores().get(task.id);
  }

  readonly errorMessage = signal('');

  latest(task: AutomationTask): AutomationRun | undefined {
    return this.runs().latest(task.id);
  }

  trigger(task: AutomationTask): string {
    return triggerSummary(
      task.triggerCondition,
      this.taskNames().get(task.triggerTaskId),
    );
  }

  vms(run: AutomationRun | undefined): string {
    const names = [
      ...new Set((run?.results ?? []).map((r) => r.vmName).filter((n) => !!n)),
    ];
    return names.length > 0 ? names.join(', ') : '—';
  }

  /** The newest result's output, or why the run ended without one. */
  output(run: AutomationRun | undefined): string {
    const result = run?.results?.[0];
    return result?.actualOutput || run?.statusDetail || '';
  }

  isRunning(run: AutomationRun | undefined): boolean {
    return !!run && !isFinal(run.status);
  }

  cannotRun(task: AutomationTask): string {
    return cannotRun(task, this.runs(), this.canAct());
  }

  cannotRerun(task: AutomationTask, run: AutomationRun): string {
    return cannotRerun(run, task, this.runs(), this.canAct());
  }

  canCancel(run: AutomationRun | undefined): boolean {
    return canCancel(run, this.canAct());
  }

  run(task: AutomationTask) {
    this.act(this.runData.run(task.id), `${task.name} could not be run.`);
  }

  rerun(task: AutomationTask, run: AutomationRun) {
    this.act(
      this.runData.rerun(run.id),
      `${task.name} could not be run again.`,
    );
  }

  cancel(task: AutomationTask, run: AutomationRun) {
    this.act(
      this.runData.cancel(run.id),
      `${task.name} could not be cancelled; it may have just ended.`,
    );
  }

  private act(
    request: ReturnType<AutomationRunDataService['run']>,
    failure: string,
  ) {
    this.errorMessage.set('');
    request.pipe(take(1)).subscribe({
      error: () => this.errorMessage.set(failure),
    });
  }
}
