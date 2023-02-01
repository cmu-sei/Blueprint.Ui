// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

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
  selector: 'app-move-edit-dialog',
  templateUrl: './move-edit-dialog.component.html',
  styleUrls: ['./move-edit-dialog.component.scss'],
})

export class MoveEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.move.situationTime,
    []
  );
  public situationTimeFormControl = new UntypedFormControl(
    this.data.move.situationTime.toTimeString().substr(0, 5),
    []
  );
  public moveStartTimeFormControl = new UntypedFormControl(
    this.data.move.moveStartTime.toTimeString().substr(0, 5),
    []
  );
  public moveStopTimeFormControl = new UntypedFormControl(
    this.data.move.moveStopTime.toTimeString().substr(0, 5),
    []
  );
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

  saveMove(which: string) {
    let timeParts: string[];
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        const oldPosted = new Date(this.data.move.situationTime);
        newPosted.setHours(oldPosted.getHours());
        newPosted.setMinutes(oldPosted.getMinutes());
        this.data.move.situationTime = newPosted;
        break;
      case 'situationTime':
        const situationTime = this.situationTimeFormControl.value;
        if (situationTime.length === 5) {
          timeParts = situationTime.split(':');
        } else {
          timeParts = this.convertTime12to24(situationTime);
        }
        this.data.move.situationTime.setHours(timeParts[0]);
        this.data.move.situationTime.setMinutes(timeParts[1]);
        break;
      case 'moveStartTime':
        const moveStartTime = this.moveStartTimeFormControl.value;
        if (moveStartTime.length === 5) {
          timeParts = moveStartTime.split(':');
        } else {
          timeParts = this.convertTime12to24(moveStartTime);
        }
        this.data.move.moveStartTime.setHours(timeParts[0]);
        this.data.move.moveStartTime.setMinutes(timeParts[1]);
        break;
      case 'moveStopTime':
        const moveStopTime = this.moveStopTimeFormControl.value;
        if (moveStopTime.length === 5) {
          timeParts = moveStopTime.split(':');
        } else {
          timeParts = this.convertTime12to24(moveStopTime);
        }
        this.data.move.moveStopTime.setHours(timeParts[0]);
        this.data.move.moveStopTime.setMinutes(timeParts[1]);
        break;
      default:
        break;
    }
    if (which === 'situationDate') {
    } else if (which === 'situationTime') {
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

  private convertTime12to24(time12h: string) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier.toUpperCase() === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }

    return [hours, minutes];
  }
}
