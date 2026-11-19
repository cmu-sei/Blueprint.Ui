// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { take } from 'rxjs/operators';
import {
  AutomationRun,
  AutomationRunSource,
  AutomationTask,
} from 'src/app/generated/blueprint.api';
import { AutomationRunDataService } from 'src/app/data/automation-run/automation-run-data.service';
import {
  DeploymentRuns,
  canCancel,
  cannotRerun,
} from 'src/app/utilities/facilitation';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';

const SOURCES: Record<AutomationRunSource, string> = {
  Manual: 'Run by hand',
  Schedule: 'At its event time',
  Chain: 'Triggered by another task',
  Rerun: 'Run again',
  GroupStart: 'Started with its group',
};

/**
 * A task's history in the deployed exercise, newest run first: who or what started each run, how it ended, and what
 * each iteration and VM answered. A facilitator can cancel a run that has not ended and run one again.
 */
@Component({
  selector: 'app-automation-results-drawer',
  imports: [
    AutomationStatusChipComponent,
    DatePipe,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
  ],
  templateUrl: './automation-results-drawer.component.html',
  styleUrls: ['./automation-results-drawer.component.scss'],
})
export class AutomationResultsDrawerComponent {
  private runData = inject(AutomationRunDataService);

  readonly task = input<AutomationTask>(undefined);
  /** "Event 4 › 2. Collect IIS log". */
  readonly label = input('');
  readonly runs = input<DeploymentRuns>(new DeploymentRuns([], null));
  readonly canAct = input(false);
  /** Names of the users who started runs, by id. */
  readonly userNames = input<Map<string, string>>(new Map());
  readonly closed = output<void>();

  readonly errorMessage = signal('');
  // outputs shown in full; the rest are cut to a few lines
  readonly expandedOutputs = new Set<string>();

  history(): AutomationRun[] {
    return this.runs().byTask.get(this.task()?.id) ?? [];
  }

  source(run: AutomationRun): string {
    return SOURCES[run.source] ?? run.source;
  }

  who(run: AutomationRun): string {
    return run.requestedBy
      ? (this.userNames().get(run.requestedBy) ?? 'A user')
      : 'Blueprint';
  }

  canCancel(run: AutomationRun): boolean {
    return canCancel(run, this.canAct());
  }

  cannotRerun(run: AutomationRun): string {
    return cannotRerun(run, this.task(), this.runs(), this.canAct());
  }

  cancel(run: AutomationRun) {
    this.errorMessage.set('');
    this.runData
      .cancel(run.id)
      .pipe(take(1))
      .subscribe({
        error: () =>
          this.errorMessage.set(
            'The run could not be cancelled; it may have just ended.',
          ),
      });
  }

  rerun(run: AutomationRun) {
    this.errorMessage.set('');
    this.runData
      .rerun(run.id)
      .pipe(take(1))
      .subscribe({
        error: () => this.errorMessage.set('The task could not be run again.'),
      });
  }

  toggleOutput(id: string) {
    if (this.expandedOutputs.has(id)) this.expandedOutputs.delete(id);
    else this.expandedOutputs.add(id);
  }
}
