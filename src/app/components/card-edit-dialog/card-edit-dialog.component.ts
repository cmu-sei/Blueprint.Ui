// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
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
    selector: 'app-card-edit-dialog',
    templateUrl: './card-edit-dialog.component.html',
    styleUrls: ['./card-edit-dialog.component.scss'],
    standalone: false
})

export class CardEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.card.situationTime,
    []
  );
  public cardStartTimeFormControl = new UntypedFormControl(
    this.data.card.cardStartTime,
    []
  );
  public cardStopTimeFormControl = new UntypedFormControl(
    this.data.card.cardStopTime,
    []
  );

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<CardEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  saveCard(which: string) {
    let timeParts: string[];
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        const oldPosted = new Date(this.data.card.situationTime);
        this.data.card.situationTime = newPosted;
        break;
      case 'cardStartTime':
        const cardStartTime = this.cardStartTimeFormControl.value;
        this.data.card.cardStartTime = cardStartTime;
        break;
      case 'cardStopTime':
        const cardStopTime = this.cardStopTimeFormControl.value;
        this.data.card.cardStopTime = cardStopTime;
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
      this.editComplete.emit({ saveChanges: false, card: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        card: this.data.card,
      });
    }
  }

}
