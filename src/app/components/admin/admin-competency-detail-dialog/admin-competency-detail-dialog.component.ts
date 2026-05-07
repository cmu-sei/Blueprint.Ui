// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Competency } from 'src/app/generated/blueprint.api';

@Component({
  selector: 'app-admin-competency-detail-dialog',
  templateUrl: './admin-competency-detail-dialog.component.html',
  styleUrls: ['./admin-competency-detail-dialog.component.scss'],
  standalone: false
})
export class AdminCompetencyDetailDialogComponent {
  competencyTypeMap: Map<string, string>;

  constructor(
    public dialogRef: MatDialogRef<AdminCompetencyDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      competency: Competency;
      competencyTypeMap: Map<string, string>;
    }
  ) {
    this.competencyTypeMap = data.competencyTypeMap;
  }

  getType(): string {
    return this.competencyTypeMap?.get(this.data.competency.id) || '';
  }

  close(): void {
    this.dialogRef.close();
  }
}
