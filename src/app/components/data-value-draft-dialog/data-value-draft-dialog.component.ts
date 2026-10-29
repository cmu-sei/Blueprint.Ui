// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { prepareImages } from 'src/app/utilities/svg-to-png';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import {
  DataField,
  DataValueDraftAction,
  DataValueDraftResult,
} from 'src/app/generated/blueprint.api';

export interface DataValueDraftDialogData {
  mselId: string;
  scenarioEventId?: string;
  deltaSeconds: number;
  dataField: DataField;
  // the inject's values as the edit dialog holds them, unsaved edits included
  values: { [dataFieldId: string]: string };
  gallerySourceTypes: string[];
}

// Writing saves nothing. Closing with a string hands the accepted value back
// to the edit dialog, where the planner can still edit it or cancel the inject.
@Component({
  selector: 'app-data-value-draft-dialog',
  templateUrl: './data-value-draft-dialog.component.html',
  styleUrls: ['./data-value-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    FormsModule,
    MatButton,
    MatFormField,
    MatHint,
    MatLabel,
    MatIcon,
    MatInput,
    MatOption,
    MatSelect,
    MatProgressSpinner,
  ],
})
export class DataValueDraftDialogComponent {
  actions: { value: DataValueDraftAction; label: string; needsValue: boolean }[] = [
    { value: DataValueDraftAction.Draft, label: 'Draft from this inject', needsValue: false },
    { value: DataValueDraftAction.Rewrite, label: 'Rewrite as...', needsValue: true },
    { value: DataValueDraftAction.Consistent, label: 'Make consistent with the scenario', needsValue: true },
    { value: DataValueDraftAction.Shorten, label: 'Shorten', needsValue: true },
    { value: DataValueDraftAction.Expand, label: 'Expand', needsValue: true },
  ];
  action: DataValueDraftAction;
  style = '';
  instruction = '';
  isWriting = false;
  errorMessage = '';
  result: DataValueDraftResult;
  readonly currentValue: string;
  readonly hasValue: boolean;

  constructor(
    public dialogRef: MatDialogRef<DataValueDraftDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: DataValueDraftDialogData,
    private mselDataService: MselDataService
  ) {
    dialogRef.disableClose = true;
    this.currentValue = data.values[data.dataField.id] ?? '';
    this.hasValue = this.currentValue.replace(/<[^>]*>/g, '').trim().length > 0;
    this.action = this.hasValue ? DataValueDraftAction.Rewrite : DataValueDraftAction.Draft;
    this.style = data.gallerySourceTypes?.[0] ?? '';
  }

  get isRewrite(): boolean {
    return this.action === DataValueDraftAction.Rewrite;
  }

  get canWrite(): boolean {
    return !this.isWriting && (this.hasValue || this.action === DataValueDraftAction.Draft);
  }

  write() {
    this.isWriting = true;
    this.errorMessage = '';
    this.mselDataService
      .draftDataValue(this.data.mselId, {
        scenarioEventId: this.data.scenarioEventId,
        dataFieldId: this.data.dataField.id,
        deltaSeconds: this.data.deltaSeconds,
        values: this.data.values,
        action: this.action,
        style: this.isRewrite ? this.style : null,
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

  // back to the options, keeping them so the planner can adjust and write again
  tryAgain() {
    this.result = undefined;
  }

  // drawn on a canvas in the browser; tests give their own
  toPng = prepareImages;

  // an article's SVG graphics become PNG, which Blueprint's own views show
  async use() {
    this.dialogRef.close(await this.toPng(this.result.value));
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
    // a server error carries the reason in detail outside development, and a stack trace inside it
    if (err?.status === 500 && detail && !detail.includes('\n')) {
      return detail;
    }
    return title || err?.message || 'Writing failed.';
  }
}
