// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { PageDraftResult } from 'src/app/generated/blueprint.api';

export interface MselPageDraftDialogData {
  mselId: string;
  pageId?: string;
  name: string;
  // the page as the editor holds it, unsaved edits included
  content: string;
}

// Writing saves nothing. Closing with a string hands the accepted page back to the
// editor, where the planner can still edit it, save it or cancel.
@Component({
  selector: 'app-msel-page-draft-dialog',
  templateUrl: './msel-page-draft-dialog.component.html',
  styleUrls: ['./msel-page-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    FormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
    MatIcon,
    MatButton,
  ],
})
export class MselPageDraftDialogComponent {
  readonly dialogRef = inject<MatDialogRef<MselPageDraftDialogComponent, string>>(MatDialogRef);
  readonly data = inject<MselPageDraftDialogData>(MAT_DIALOG_DATA);
  private mselDataService = inject(MselDataService);
  instruction = '';
  isWriting = false;
  errorMessage = '';
  result: PageDraftResult;
  readonly hasContent: boolean;

  constructor() {
    this.dialogRef.disableClose = true;
    this.hasContent = (this.data.content ?? '').replace(/<[^>]*>/g, '').trim().length > 0;
  }

  // a page with content is changed as asked; an empty one is written for its name
  get canWrite(): boolean {
    return !this.isWriting && (this.hasContent ? this.instruction.trim().length > 0 : true);
  }

  write() {
    this.isWriting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftPage(this.data.mselId, {
        pageId: this.data.pageId,
        name: this.data.name,
        content: this.data.content,
        instruction: this.instruction,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isWriting = false;
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err);
          this.isWriting = false;
        },
      });
  }

  // back to the instruction, keeping it so the planner can adjust and write again
  tryAgain() {
    this.result = undefined;
  }

  use() {
    this.dialogRef.close(this.result.html);
  }

  close() {
    this.dialogRef.close();
  }

  private getErrorMessage(err: HttpErrorResponse | { error?: { title?: string; detail?: string }; status?: number; message?: string }): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    // a server error carries the reason in detail outside development, and a stack trace inside it
    if (err?.status === 500 && detail && !detail.includes('\n')) {
      return detail;
    }
    return title || err?.message || 'Writing failed.';
  }
}
