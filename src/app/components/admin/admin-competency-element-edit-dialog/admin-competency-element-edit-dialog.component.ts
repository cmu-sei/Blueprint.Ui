// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
    selector: 'app-admin-competency-element-edit-dialog',
    templateUrl: './admin-competency-element-edit-dialog.component.html',
    styleUrls: ['./admin-competency-element-edit-dialog.component.scss'],
    standalone: false
})

export class AdminCompetencyElementEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<AdminCompetencyElementEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return this.data.element.name;
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, element: null });
    } else {
      if (this.errorFree()) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          element: this.data.element,
        });
      }
    }
  }
}
