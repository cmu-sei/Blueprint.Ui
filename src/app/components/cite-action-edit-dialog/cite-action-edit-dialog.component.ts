// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MoveQuery } from 'src/app/data/move/move.query';

@Component({
    selector: 'app-cite-action-edit-dialog',
    templateUrl: './cite-action-edit-dialog.component.html',
    styleUrls: ['./cite-action-edit-dialog.component.scss'],
    standalone: false
})

export class CiteActionEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  moveList = this.moveQuery.getAll().sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);

  constructor(
    private moveQuery: MoveQuery,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

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
