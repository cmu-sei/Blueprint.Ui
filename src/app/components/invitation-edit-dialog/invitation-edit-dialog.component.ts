// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
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
  selector: 'app-invitation-edit-dialog',
  templateUrl: './invitation-edit-dialog.component.html',
  styleUrls: ['./invitation-edit-dialog.component.scss'],
})

export class InvitationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public invitationNameFormControl = new UntypedFormControl(
    this.data.invitation.name,
    [
      Validators.required
    ]
  );
  public invitationShortNameFormControl = new UntypedFormControl(
    this.data.invitation.shortName,
    [
      Validators.required
    ]
  );
  public invitationEmailFormControl = new UntypedFormControl(
    this.data.invitation.email,
    [
      Validators.required
    ]
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.invitation.description ,
    []
  );
  public summaryFormControl = new UntypedFormControl(
    this.data.invitation.summary,
    []
  );
  editorStyle = {
    'min-height': '100px',
    'max-height': '400px',
    'overflow': 'auto'
  };

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<InvitationEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return true;
    return !(
      this.invitationNameFormControl.hasError('required') ||
      this.invitationNameFormControl.hasError('minlength') ||
      !this.data.invitation.summary
    );
  }

  trimInitialDescription() {
    if (
      this.descriptionFormControl.value &&
      this.descriptionFormControl.value.toString()[0] === ' '
    ) {
      this.descriptionFormControl.setValue(
        this.descriptionFormControl.value.toString().trim()
      );
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, invitation: null });
    } else {
      this.data.invitation.name = this.invitationNameFormControl.value
        .toString()
        .trim();
      this.data.invitation.description = this.descriptionFormControl.value
        .toString()
        .trim();
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          invitation: this.data.invitation,
        });
      }
    }
  }

  /**
   * Saves the current invitation
   */
  saveInvitation(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.invitation.name = this.invitationNameFormControl.value ? this.invitationNameFormControl.value.toString() : '';
        break;
      case 'shortName':
        this.data.invitation.shortName =
            this.invitationShortNameFormControl.value ? this.invitationShortNameFormControl.value.toString() : '';
        break;
      case 'description':
        this.data.invitation.description = this.descriptionFormControl.value ? this.descriptionFormControl.value.toString() : '';
        break;
      case 'summary':
        this.data.invitation.summary = this.summaryFormControl.value;
        break;
      case 'email':
        this.data.invitation.email = this.invitationEmailFormControl.value ? this.invitationEmailFormControl.value.toString() : '';
        break;
      default:
        break;
    }
  }

}
