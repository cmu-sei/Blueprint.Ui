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

@Component({
  selector: 'app-admin-unit-edit-dialog',
  templateUrl: './admin-unit-edit-dialog.component.html',
  styleUrls: ['./admin-unit-edit-dialog.component.scss'],
})

export class AdminUnitEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public unitNameFormControl = new UntypedFormControl(
    this.data.unit.name,
    [
      Validators.required,
    ]
  );
  public unitShortNameFormControl = new UntypedFormControl(
    this.data.unit.shortName,
    [
      Validators.required,
    ]
  );

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<AdminUnitEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return !(
      this.unitNameFormControl.hasError('required') ||
      this.unitNameFormControl.hasError('minlength') ||
      this.unitShortNameFormControl.hasError('required') ||
      this.unitShortNameFormControl.hasError('minlength')
    );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, unit: null });
    } else {
      this.data.unit.name = this.unitNameFormControl.value
        .toString()
        .trim();
      this.data.unit.shortName = this.unitShortNameFormControl.value
        .toString()
        .trim();
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          unit: this.data.unit,
        });
      }
    }
  }

  /**
   * Saves the current unit
   */
  saveUnit(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.unit.name = this.unitNameFormControl.value.toString();
        break;
      case 'shortName':
        this.data.unit.shortName = this.unitShortNameFormControl.value.toString();
        break;
      default:
        break;
    }
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
