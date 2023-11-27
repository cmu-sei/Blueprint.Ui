// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
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
  selector: 'app-move-edit-dialog',
  templateUrl: './move-edit-dialog.component.html',
  styleUrls: ['./move-edit-dialog.component.scss'],
})

export class MoveEditDialogComponent implements OnInit {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.move.situationTime,
    []
  );
  moveStartTimeFormControl = new UntypedFormControl(
    this.getDateFromDeltaSeconds(this.data.move.deltaSeconds),
    []
  );
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;
  editorStyle = {
    'min-height': '100px',
    'max-height': '400px',
    'overflow': 'auto'
  };

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<MoveEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {
    this.setDeltaValues();
  }

  saveMove(which: string) {
    let timeParts: string[];
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        const oldPosted = new Date(this.data.move.situationTime);
        this.data.move.situationTime = newPosted;
        break;
      case 'moveStartTime':
        const moveStartTime = this.moveStartTimeFormControl.value;
        this.data.move.moveStartTime = moveStartTime;
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
      this.editComplete.emit({ saveChanges: false, move: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        move: this.data.move,
      });
    }
  }

  getDateFromDeltaSeconds(deltaSeconds: number): Date {
    const mselStartTime = new Date(this.data.mselStartTime);
    return new Date(mselStartTime.getTime() + (deltaSeconds * 1000));
  }

  getDeltaSecondsFromDate() {
    const moveValue = this.moveStartTimeFormControl.value;
    const moveSeconds = moveValue.getTime() / 1000;
    const startValue = new Date(this.data.mselStartTime);
    const startSeconds = startValue.getTime() / 1000;
    return moveSeconds - startSeconds;
  }

  setDeltaValues() {
    let deltaSeconds = this.getDeltaSecondsFromDate();
    this.data.move.deltaSeconds = deltaSeconds;
    // get the number of days
    this.days = Math.floor(deltaSeconds / 86400);
    deltaSeconds = deltaSeconds % 86400;
    // get the number of hours
    this.hours = Math.floor(deltaSeconds / 3600);
    deltaSeconds = deltaSeconds % 3600;
    // get the number of minutes
    this.minutes = Math.floor(deltaSeconds / 60);
    deltaSeconds = deltaSeconds % 60;
    // get the number of seconds
    this.seconds = +deltaSeconds;
  }

  calculateDeltaSeconds() {
    return this.days * 86400 + this.hours * 3600 + this.minutes * 60 + this.seconds;
  }

  deltaUpdated(event: any, whichValue: string) {
    let setValue = +event.target.value;
    switch (whichValue) {
      case 'd':
        setValue = setValue < 0 ? 0 : setValue;
        this.days = setValue;
        break;
      case 'h':
        setValue = setValue < 0 ? 0 : setValue > 23 ? 23 : setValue;
        this.hours = setValue;
        break;
      case 'm':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.minutes = setValue;
        break;
      case 's':
        setValue = setValue < 0 ? 0 : setValue > 59 ? 59 : setValue;
        this.seconds = setValue;
        break;
    }
    this.data.move.deltaSeconds = this.calculateDeltaSeconds();
    this.moveStartTimeFormControl.setValue(this.getDateFromDeltaSeconds(this.data.move.deltaSeconds));
  }

  timeUpdated() {
    this.data.move.deltaSeconds = this.getDeltaSecondsFromDate();
    this.setDeltaValues();
  }

}
