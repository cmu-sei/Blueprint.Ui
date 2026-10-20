// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-admin-proficiency-scale-edit-dialog',
    templateUrl: './admin-proficiency-scale-edit-dialog.component.html',
    styleUrls: ['./admin-proficiency-scale-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule]
})

export class AdminProficiencyScaleEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  errorFree() {
    return this.data.scale.name;
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, scale: null });
    } else {
      if (this.errorFree()) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          scale: this.data.scale,
        });
      }
    }
  }
}
