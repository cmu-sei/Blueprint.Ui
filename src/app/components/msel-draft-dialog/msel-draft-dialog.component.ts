// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import {
  DataFieldType,
  Msel,
  MselDraftImport,
  MselDraftInject,
  MselDraftResult,
} from 'src/app/generated/blueprint.api';

export interface MselDraftDialogData {
  templates: Msel[];
}

// Drafting writes nothing. Closing with a MselDraftImport hands the reviewed
// draft to the import dialog, which creates the MSEL and reports on it.
@Component({
  selector: 'app-msel-draft-dialog',
  templateUrl: './msel-draft-dialog.component.html',
  styleUrls: ['./msel-draft-dialog.component.scss'],
  standalone: false,
})
export class MselDraftDialogComponent {
  templateMselId = '';
  prompt = '';
  isDrafting = false;
  errorMessage = '';
  result: MselDraftResult;

  constructor(
    public dialogRef: MatDialogRef<MselDraftDialogComponent, MselDraftImport>,
    @Inject(MAT_DIALOG_DATA) public data: MselDraftDialogData,
    private mselDataService: MselDataService
  ) {
    dialogRef.disableClose = true;
    if (data.templates.length === 1) {
      this.templateMselId = data.templates[0].id;
    }
  }

  get canDraft(): boolean {
    return !!this.templateMselId && this.prompt.trim().length > 0 && !this.isDrafting;
  }

  draft() {
    this.isDrafting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftMsel({ templateMselId: this.templateMselId, prompt: this.prompt })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isDrafting = false;
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err);
          this.isDrafting = false;
        },
      });
  }

  // back to the prompt, keeping it so the planner can reword and draft again
  startOver() {
    this.result = undefined;
  }

  removeInject(inject: MselDraftInject) {
    this.result.draft.injects = this.result.draft.injects.filter((i) => i !== inject);
  }

  moveFor(inject: MselDraftInject): number {
    const moves = this.result.draft.moves ?? [];
    const move = [...moves].reverse().find((m) => m.startMinutes <= inject.minutes);
    return move?.moveNumber ?? 0;
  }

  // the column that best names a row: a Title-like column, else the first text column
  titleFor(inject: MselDraftInject): string {
    const values = inject.values ?? {};
    const titleField = this.result.fields.find((f) =>
      ['title', 'message', 'name'].includes(f.name.toLowerCase())
    );
    if (titleField && values[titleField.name]) {
      return values[titleField.name];
    }
    const textField = this.result.fields.find(
      (f) => f.dataType === DataFieldType.String && values[f.name]
    );
    return textField ? values[textField.name] : '';
  }

  recipientsFor(inject: MselDraftInject): string {
    const field = this.result.fields.find((f) => f.dataType === DataFieldType.TeamsMultiple);
    return field ? (inject.values?.[field.name] ?? '') : '';
  }

  valuesFor(inject: MselDraftInject): { name: string; value: string }[] {
    return this.result.fields
      .filter((f) => inject.values?.[f.name])
      .map((f) => ({ name: f.name, value: inject.values[f.name] }));
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  create() {
    this.dialogRef.close({
      templateMselId: this.result.templateMselId,
      draft: this.result.draft,
    });
  }

  close() {
    this.dialogRef.close();
  }

  private getErrorMessage(err: any): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail ? `${title} ${detail}` : title;
    }
    return err?.message || 'The draft failed.';
  }
}
