// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { CrucibleDialogActionsDirective, CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';

export interface MselImageDialogData {
  /** The current picture, or null for a MSEL without one */
  url: string | null;
  name: string;
  /** Whether the planner may ask for a new picture */
  canGenerate: boolean;
}

/** What the dialog answers: the planner asked for a picture, with what it should show or change */
export interface MselImageDialogResult {
  prompt: string;
}

/**
 * The MSEL's card image at full size, since its preview on the Info tab is small, with a box for what the next picture
 * should show or change, since the same scenario asked again gives much the same picture.
 */
@Component({
  selector: 'app-msel-image-dialog',
  templateUrl: './msel-image-dialog.component.html',
  styleUrls: ['./msel-image-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, CrucibleDialogActionsDirective, MatButton, MatFormField, MatLabel, MatHint, MatInput, FormsModule],
})
export class MselImageDialogComponent {
  readonly data = inject<MselImageDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MselImageDialogComponent, MselImageDialogResult>);
  prompt = '';

  generate() {
    this.dialogRef.close({ prompt: this.prompt.trim() });
  }

  close() {
    this.dialogRef.close();
  }
}
