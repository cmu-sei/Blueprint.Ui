// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MoveQuery } from 'src/app/data/move/move.query';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';

@Component({
    selector: 'app-cite-action-edit-dialog',
    templateUrl: './cite-action-edit-dialog.component.html',
    styleUrls: ['./cite-action-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatSelect, FormsModule, MatOption, MatInput]
})

export class CiteActionEditDialogComponent {
  private moveQuery = inject(MoveQuery);
  data = inject(MAT_DIALOG_DATA);

  @Output() editComplete = new EventEmitter<any>();
  moveList = this.moveQuery.getAll().sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);

  errorFree() {
    return this.data.citeAction.description && this.data.citeAction.description.length > 0;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, citeAction: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          citeAction: this.data.citeAction,
        });
      }
    }
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
