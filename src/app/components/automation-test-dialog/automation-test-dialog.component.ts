// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogClose } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { EMPTY, Observable, interval, of } from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  take,
  takeWhile,
} from 'rxjs/operators';
import {
  AutomationRun,
  AutomationRunKind,
  AutomationService,
  AutomationVmPreview,
  PlayerService,
  View,
} from 'src/app/generated/blueprint.api';
import { AutomationActionDataService } from 'src/app/data/automation-action/automation-action-data.service';
import { AutomationRunDataService } from 'src/app/data/automation-run/automation-run-data.service';
import { AutomationRunQuery } from 'src/app/data/automation-run/automation-run.query';
import {
  AutomationTaskDraft,
  isFinal,
  toFields,
} from 'src/app/utilities/automation-tasks';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';

/** What the API said was wrong: a ProblemDetails' detail, or its title. */
function problemText(error: unknown): string | undefined {
  const body = (error as { error?: unknown } | null)?.error;
  if (body && typeof body === 'object') {
    const { detail, title } = body as { detail?: unknown; title?: unknown };
    if (typeof detail === 'string' && detail) return detail;
    if (typeof title === 'string' && title) return title;
  }
  return undefined;
}

export interface AutomationTestDialogData {
  mselId: string;
  scenarioEventId: string;
  /** "Event 4", to title the dialog. */
  eventLabel: string;
  /** The tasks that can be tested; the first is chosen, unless taskId names another. */
  tasks: AutomationTaskDraft[];
  taskId?: string;
  /** Which of the tasks are saved, and so tested with their stored secrets and history. */
  savedTaskIds: string[];
  /** The view to choose first: the MSEL's test view, or its own. */
  playerViewId?: string | null;
  /** The MSEL's own deployed view, which a test is warned about touching. */
  deployedPlayerViewId?: string | null;
}

/**
 * Tests an automation task against one of the user's own Player views, as it is in the editor, saved or not. The
 * run is a test: it is kept apart from the exercise's history and only the newest few are kept.
 */
@Component({
  selector: 'app-automation-test-dialog',
  imports: [
    AsyncPipe,
    AutomationStatusChipComponent,
    CrucibleDialogActionsDirective,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    DatePipe,
    FormsModule,
    MatButton,
    MatCheckbox,
    MatDialogClose,
    MatFormField,
    MatIcon,
    MatLabel,
    MatOption,
    MatSelect,
  ],
  templateUrl: './automation-test-dialog.component.html',
  styleUrls: ['./automation-test-dialog.component.scss'],
})
export class AutomationTestDialogComponent {
  readonly data = inject<AutomationTestDialogData>(MAT_DIALOG_DATA);
  private actionData = inject(AutomationActionDataService);
  private automationService = inject(AutomationService);
  private playerService = inject(PlayerService);
  private runData = inject(AutomationRunDataService);
  private runQuery = inject(AutomationRunQuery);
  private destroyRef = inject(DestroyRef);

  readonly views = signal<View[] | undefined>(undefined);
  readonly viewsError = signal('');
  readonly playerViewId = signal<string | null>(null);
  readonly taskId = signal(this.data.taskId ?? this.data.tasks[0]?.id);
  readonly includeChain = signal(false);
  readonly preview = signal<AutomationVmPreview | undefined>(undefined);
  readonly running = signal(false);
  readonly errorMessage = signal('');
  readonly runId = signal<string | null>(null);

  readonly task = computed(() =>
    this.data.tasks.find((t) => t.id === this.taskId()),
  );
  readonly definition = computed(() =>
    this.actionData.get(this.task()?.action),
  );
  readonly isSaved = computed(() =>
    this.data.savedTaskIds.includes(this.taskId()),
  );
  readonly touchesDeployedView = computed(
    () =>
      !!this.data.deployedPlayerViewId &&
      this.playerViewId() === this.data.deployedPlayerViewId,
  );
  readonly run$: Observable<AutomationRun | undefined> = toObservable(
    this.runId,
  ).pipe(
    switchMap((id) => (id ? this.runQuery.selectEntity(id) : of(undefined))),
  );
  readonly previous$: Observable<AutomationRun[]> = toObservable(
    this.taskId,
  ).pipe(
    switchMap((id) =>
      this.isSaved()
        ? this.runQuery.selectByTask(id, AutomationRunKind.Test)
        : of<AutomationRun[]>([]),
    ),
    map((runs) => runs.filter((r) => r.id !== this.runId()).slice(0, 5)),
  );

  constructor() {
    this.actionData.load();
    this.playerService
      .getMyPlayerViews()
      .pipe(take(1))
      .subscribe({
        next: (views) => {
          const sorted = [...views].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? ''),
          );
          this.views.set(sorted);
          const preferred = sorted.find((v) => v.id === this.data.playerViewId);
          this.setView(preferred?.id ?? sorted[0]?.id ?? null);
        },
        error: () =>
          this.viewsError.set(
            'Your Player views could not be read, so there is no view to test against.',
          ),
      });
    toObservable(this.taskId)
      .pipe(takeUntilDestroyed())
      .subscribe((id) => {
        if (this.data.savedTaskIds.includes(id)) {
          this.runData.loadByTask(this.data.mselId, id, AutomationRunKind.Test);
        }
        this.refreshPreview();
      });
  }

  setView(id: string | null) {
    this.playerViewId.set(id);
    this.refreshPreview();
  }

  setTask(id: string) {
    this.taskId.set(id);
    this.runId.set(null);
  }

  refreshPreview() {
    const task = this.task();
    const viewId = this.playerViewId();
    if (
      !task ||
      !viewId ||
      !this.actionData.get(task.action)?.requiresVm ||
      !task.vmMask
    ) {
      this.preview.set(undefined);
      return;
    }
    this.automationService
      .previewAutomationTaskVms(this.data.mselId, {
        playerViewId: viewId,
        vmMask: task.vmMask,
      })
      .pipe(
        take(1),
        catchError(() =>
          of({ error: 'The VMs could not be listed.', vms: [] }),
        ),
      )
      .subscribe((p) => this.preview.set(p));
  }

  canRun(): boolean {
    const definition = this.definition();
    const needsView = (definition?.requires ?? []).includes('playerView');
    return (
      !!this.task() &&
      !this.running() &&
      (!needsView || !!this.playerViewId()) &&
      !(definition?.requiresVm && (this.preview()?.vms?.length ?? 0) === 0)
    );
  }

  runTest() {
    const task = this.task();
    if (!task) return;
    this.running.set(true);
    this.errorMessage.set('');
    this.runData
      .test({
        scenarioEventId: this.data.scenarioEventId,
        taskId: this.isSaved() ? task.id : null,
        task: toFields(task),
        playerViewId: this.playerViewId(),
        includeChain: this.includeChain(),
      })
      .pipe(take(1))
      .subscribe({
        next: (run) => {
          this.runId.set(run.id);
          this.watch(run.id);
        },
        error: (error: unknown) => {
          this.running.set(false);
          this.errorMessage.set(
            problemText(error) ?? 'The test could not be started.',
          );
        },
      });
  }

  /**
   * Follows the run to its end. Its updates arrive over SignalR for those who can open the Facilitator View; the
   * API is also asked every two seconds, for an author who is not one of them.
   */
  private watch(id: string) {
    interval(2000)
      .pipe(
        switchMap(() =>
          this.automationService
            .getAutomationRun(id)
            .pipe(catchError(() => EMPTY)),
        ),
        takeWhile((run) => !isFinal(run.status), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((run) => this.runData.updateStore(run));
    this.runQuery
      .selectEntity(id)
      .pipe(
        filter((run) => isFinal(run?.status)),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.running.set(false));
  }

  taskLabel(task: AutomationTaskDraft): string {
    const index = this.data.tasks.indexOf(task);
    return `${index + 1}. ${task.name || 'New task'}`;
  }
}
