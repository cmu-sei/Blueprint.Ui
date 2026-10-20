// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-admin-proficiency-level-edit-dialog',
    templateUrl: './admin-proficiency-level-edit-dialog.component.html',
    styleUrls: ['./admin-proficiency-level-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule]
})

export class AdminProficiencyLevelEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

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
