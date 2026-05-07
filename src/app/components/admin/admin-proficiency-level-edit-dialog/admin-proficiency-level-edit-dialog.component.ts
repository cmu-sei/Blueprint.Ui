// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
    selector: 'app-admin-proficiency-level-edit-dialog',
    templateUrl: './admin-proficiency-level-edit-dialog.component.html',
    styleUrls: ['./admin-proficiency-level-edit-dialog.component.scss'],
    standalone: false
})

export class AdminProficiencyLevelEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<AdminProficiencyLevelEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return this.data.level.name;
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, level: null });
    } else {
      if (this.errorFree()) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          level: this.data.level,
        });
      }
    }
  }
}
