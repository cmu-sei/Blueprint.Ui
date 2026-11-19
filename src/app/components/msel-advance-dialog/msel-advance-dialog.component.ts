// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject, signal } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  AutomationTask,
  MselAdvanceResult,
} from 'src/app/generated/blueprint.api';
import { MselExecutionDataService } from 'src/app/data/msel-execution/msel-execution-data.service';

export interface MselAdvanceDialogData {
  mselId: string;
  moveNumber: number;
  /** The group to start; none starts the move. */
  groupNumber?: number;
  /** The integrations the start moves: the MSEL's CITE evaluation and Gallery exhibit. */
  hasCite: boolean;
  hasGallery: boolean;
  /** The manual tasks it can run, in order, each with "Event 4 › 1. Snapshot web-01". */
  tasks: { task: AutomationTask; label: string }[];
}

/**
 * Starts a move or a group of a deployed MSEL, as Steamfitter's Move Change and Inject Change tasks did: it moves the
 * CITE evaluation and the Gallery exhibit, then runs the manual tasks chosen, one after another.
 */
@Component({
  selector: 'app-msel-advance-dialog',
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatCheckbox,
  ],
  template: `
    <crucible-dialog
      [dialogTitle]="title"
      [submitLabel]="isGroup ? 'Start Group' : 'Start Move'"
      [loading]="saving()"
      loadingLabel="Starting…"
      [errorMessage]="errorMessage()"
      (submit)="start()"
    >
      <div crucibleDialogContent>
        <p>This will:</p>
        <ul>
          @if (!isGroup && data.hasCite) {
            <li>Set the CITE evaluation to move {{ data.moveNumber }}</li>
          }
          @if (data.hasGallery) {
            <li>
              Set the Gallery exhibit to move {{ data.moveNumber }}, inject
              {{ data.groupNumber ?? 0 }}
            </li>
          }
          <li>
            Make {{ isGroup ? 'this group' : 'this move' }} the MSEL's current
            one on the Facilitator View
          </li>
        </ul>
        @if (data.tasks.length > 0) {
          <p>Run these manual tasks, in order:</p>
          <div class="advance-tasks">
            @for (t of data.tasks; track t.task.id) {
              <mat-checkbox
                [checked]="chosen.has(t.task.id)"
                (change)="choose(t.task.id, $event.checked)"
                >{{ t.label }}</mat-checkbox
              >
            }
          </div>
        } @else {
          <p class="advance-note">
            {{ isGroup ? 'The group' : 'The move' }} has no manual tasks to run.
          </p>
        }
        @for (message of messages(); track message) {
          <p role="status" class="advance-note">{{ message }}</p>
        }
      </div>
    </crucible-dialog>
  `,
  styles: `
    .advance-tasks {
      display: flex;
      flex-direction: column;
    }
    .advance-note {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class MselAdvanceDialogComponent {
  readonly data = inject<MselAdvanceDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<MselAdvanceDialogComponent>);
  private executionData = inject(MselExecutionDataService);

  readonly isGroup = this.data.groupNumber != null;
  readonly title = this.isGroup
    ? `Start Move ${this.data.moveNumber} · Group ${this.data.groupNumber}`
    : `Start Move ${this.data.moveNumber}`;
  readonly chosen = new Set(this.data.tasks.map((t) => t.task.id));
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly messages = signal<string[]>([]);

  choose(taskId: string, checked: boolean) {
    if (checked) this.chosen.add(taskId);
    else this.chosen.delete(taskId);
  }

  start() {
    const runTaskIds = this.data.tasks
      .map((t) => t.task.id)
      .filter((id) => this.chosen.has(id));
    const request: Observable<MselAdvanceResult> = this.isGroup
      ? this.executionData.startGroup(
          this.data.mselId,
          this.data.moveNumber,
          this.data.groupNumber,
          runTaskIds,
        )
      : this.executionData.startMove(
          this.data.mselId,
          this.data.moveNumber,
          runTaskIds,
        );
    this.saving.set(true);
    this.errorMessage.set('');
    this.dialogRef.disableClose = true;
    request.pipe(take(1)).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        if (result.succeeded) {
          this.dialogRef.close(result);
        } else {
          // the move was made current; what the integrations refused is said here
          this.messages.set(result.messages ?? []);
          this.errorMessage.set(
            'Started, but not everything could be changed. Close this when you have read why.',
          );
        }
      },
      error: () => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        this.errorMessage.set(
          `${this.title} failed. Nothing was changed; try again.`,
        );
      },
    });
  }
}
