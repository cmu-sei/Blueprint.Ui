// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
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
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { DataValue } from 'src/app/generated/blueprint.api';

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
    selector: 'app-inject-edit-dialog',
    templateUrl: './inject-edit-dialog.component.html',
    styleUrls: ['./inject-edit-dialog.component.scss'],
    standalone: false
})
export class InjectEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  isChanged = false;

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<InjectEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return this.data.inject.name && this.data.inject.description;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, inject: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          inject: this.data.inject,
        });
      }
    }
  }

  getDataValue(dataFieldId: string): DataValue {
    const dataValue = this.data.inject.dataValues.find(
      (dv) => dv.dataFieldId === dataFieldId
    );
    return dataValue ? dataValue : ({} as DataValue);
  }

  otherInjects(id: string) {
    return this.data.injectList.filter((i) => i.id !== id);
  }
}
