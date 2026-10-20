// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Competency } from 'src/app/generated/blueprint.api';
import { CrucibleDialogComponent, CrucibleDialogContentDirective, CrucibleDialogActionsDirective } from '@cmusei/crucible-common';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'app-admin-competency-detail-dialog',
    templateUrl: './admin-competency-detail-dialog.component.html',
    styleUrls: ['./admin-competency-detail-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, CrucibleDialogActionsDirective, MatButton]
})
export class AdminCompetencyDetailDialogComponent {
  dialogRef = inject<MatDialogRef<AdminCompetencyDetailDialogComponent>>(MatDialogRef);
  data = inject<{
    competency: Competency;
    competencyTypeMap: Map<string, string>;
}>(MAT_DIALOG_DATA);

  competencyTypeMap: Map<string, string>;

  constructor() {
    const data = this.data;

    this.competencyTypeMap = data.competencyTypeMap;
  }

  getType(): string {
    return this.competencyTypeMap?.get(this.data.competency.id) || '';
  }

  close(): void {
    this.dialogRef.close();
  }
}
