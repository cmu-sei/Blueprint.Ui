// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}

const MIN_NAME_LENGTH = 3;

@Component({
  selector: 'app-player-applicationedit-dialog',
  templateUrl: './player-application-edit-dialog.component.html',
  styleUrls: ['./player-application-edit-dialog.component.scss'],
})

export class PlayerApplicationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.playerApplication.situationTime,
    []
  );
  public playerApplicationStartTimeFormControl = new UntypedFormControl(
    this.data.playerApplication.playerApplicationStartTime,
    []
  );
  public playerApplicationStopTimeFormControl = new UntypedFormControl(
    this.data.playerApplication.playerApplicationStopTime,
    []
  );
  editorStyle = {
    'min-height': '100px',
    'max-height': '400px',
    'overflow': 'auto'
  };

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<PlayerApplicationEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  savePlayerApplication(which: string) {
    let timeParts: string[];
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        const oldPosted = new Date(this.data.playerApplication.situationTime);
        this.data.playerApplication.situationTime = newPosted;
        break;
      case 'playerApplicationStartTime':
        const playerApplicationStartTime = this.playerApplicationStartTimeFormControl.value;
        this.data.playerApplication.playerApplicationStartTime = playerApplicationStartTime;
        break;
      case 'playerApplicationStopTime':
        const playerApplicationStopTime = this.playerApplicationStopTimeFormControl.value;
        this.data.playerApplication.playerApplicationStopTime = playerApplicationStopTime;
        break;
      default:
        break;
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, playerApplication: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        playerApplication: this.data.playerApplication,
      });
    }
  }

}
