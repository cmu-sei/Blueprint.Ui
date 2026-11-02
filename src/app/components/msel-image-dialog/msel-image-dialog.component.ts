// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { CrucibleDialogActionsDirective, CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';

export interface MselImageDialogData {
  url: string;
  name: string;
}

/** The MSEL's card image at full size, since its preview on the Info tab is small. */
@Component({
  selector: 'app-msel-image-dialog',
  templateUrl: './msel-image-dialog.component.html',
  styleUrls: ['./msel-image-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, CrucibleDialogActionsDirective, MatButton],
})
export class MselImageDialogComponent {
  readonly data = inject<MselImageDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MselImageDialogComponent>);

  close() {
    this.dialogRef.close();
  }
}
