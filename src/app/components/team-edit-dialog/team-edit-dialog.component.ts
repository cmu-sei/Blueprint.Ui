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
  selector: 'app-team-edit-dialog',
  templateUrl: './team-edit-dialog.component.html',
  styleUrls: ['./team-edit-dialog.component.scss'],
})

export class TeamEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public teamNameFormControl = new UntypedFormControl(
    this.data.team.name,
    [
      Validators.required,
    ]
  );
  public teamShortNameFormControl = new UntypedFormControl(
    this.data.team.shortName,
    [
      Validators.required,
    ]
  );
  public emailFormControl = new UntypedFormControl(
    this.data.team.email,
    []
  );
  public citeTeamTypeIdFormControl = new UntypedFormControl(
    this.data.team.citeTeamTypeId,
    []
  );

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<TeamEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  readonly MIN_NAME_LENGTH = MIN_NAME_LENGTH;

  errorFree() {
    return !(
      this.teamNameFormControl.hasError('required') ||
      this.teamNameFormControl.hasError('minlength') ||
      this.teamShortNameFormControl.hasError('required') ||
      this.teamShortNameFormControl.hasError('minlength')
    );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, team: null });
    } else {
      this.data.team.name = this.teamNameFormControl.value
        .toString()
        .trim();
      this.data.team.shortName = this.teamShortNameFormControl.value
        .toString()
        .trim();
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          team: this.data.team,
        });
      }
    }
  }

  /**
   * Saves the current team
   */
  saveTeam(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.team.name = this.teamNameFormControl.value.toString();
        break;
      case 'shortName':
        this.data.team.shortName = this.teamShortNameFormControl.value.toString();
        break;
      case 'email':
        this.data.team.email = this.emailFormControl.value.toString();
        break;
      case 'citeTeamTypeId':
        this.data.team.citeTeamTypeId = this.citeTeamTypeIdFormControl.value.toString();
        break;
      default:
        break;
    }
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
