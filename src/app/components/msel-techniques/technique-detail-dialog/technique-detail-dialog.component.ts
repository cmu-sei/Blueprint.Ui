// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { Technique } from 'src/app/generated/blueprint.api';

export interface TechniqueDetailDialogData {
  technique: Technique;
  /** The heading for the technique's groups, e.g. "Tactics". */
  groupsLabel: string;
  /** The technique's groups by display name. */
  groupNames: string;
}

/** Shows a technique's full description, which is often too long for a tooltip. */
@Component({
  selector: 'app-technique-detail-dialog',
  templateUrl: './technique-detail-dialog.component.html',
  styleUrls: ['./technique-detail-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
  ],
})
export class TechniqueDetailDialogComponent {
  dialogRef =
    inject<MatDialogRef<TechniqueDetailDialogComponent>>(MatDialogRef);
  data = inject<TechniqueDetailDialogData>(MAT_DIALOG_DATA);

  get title(): string {
    const t = this.data.technique;
    return [t?.externalId, t?.name].filter(Boolean).join(' ');
  }

  close(): void {
    this.dialogRef.close();
  }
}
