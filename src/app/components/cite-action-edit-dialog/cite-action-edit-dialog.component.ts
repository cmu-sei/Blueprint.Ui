// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  FormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { MoveQuery } from 'src/app/data/move/move.query';

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: FormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}

@Component({
  selector: 'app-cite-action-edit-dialog',
  templateUrl: './cite-action-edit-dialog.component.html',
  styleUrls: ['./cite-action-edit-dialog.component.scss'],
})

export class CiteActionEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  moveList = this.moveQuery.getAll().sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<CiteActionEditDialogComponent>,
    private moveQuery: MoveQuery,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

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
