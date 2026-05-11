// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { MselCompetency } from 'src/app/generated/blueprint.api';

export interface TeamCompetencyPropagateData {
  teamName: string;
  action: 'add' | 'remove';
  competencies: MselCompetency[];
}

@Component({
  selector: 'app-team-competency-propagate-dialog',
  templateUrl: './team-competency-propagate-dialog.component.html',
  styleUrls: ['./team-competency-propagate-dialog.component.scss'],
  standalone: false
})
export class TeamCompetencyPropagateDialogComponent {
  selection = new SelectionModel<MselCompetency>(true, []);
  displayedColumns = ['select', 'idNumber', 'shortName'];

  constructor(
    public dialogRef: MatDialogRef<TeamCompetencyPropagateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TeamCompetencyPropagateData
  ) {
    this.dialogRef.disableClose = true;
    // Pre-select all
    this.selection.select(...data.competencies);
  }

  get actionVerb(): string {
    return this.data.action === 'add' ? 'add' : 'remove';
  }

  get preposition(): string {
    return this.data.action === 'add' ? 'to' : 'from';
  }

  isAllSelected(): boolean {
    return this.selection.selected.length === this.data.competencies.length;
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.data.competencies);
    }
  }

  onConfirm(): void {
    this.dialogRef.close(this.selection.selected);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
