// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

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
  selector: 'app-organization-edit-dialog',
  templateUrl: './organization-edit-dialog.component.html',
  styleUrls: ['./organization-edit-dialog.component.scss'],
})

export class OrganizationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public organizationNameFormControl = new UntypedFormControl(
    this.data.organization.name,
    [
      Validators.required
    ]
  );
  public organizationShortNameFormControl = new UntypedFormControl(
    this.data.organization.shortName,
    [
      Validators.required
    ]
  );
  public organizationEmailFormControl = new UntypedFormControl(
    this.data.organization.email,
    [
      Validators.required
    ]
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.organization.description ,
    []
  );
  public summaryFormControl = new UntypedFormControl(
    this.data.organization.summary,
    []
  );
  editorStyle = {
    'min-height': '100px',
    'max-height': '400px',
    'overflow': 'auto'
  };

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<OrganizationEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return true;
    return !(
      this.organizationNameFormControl.hasError('required') ||
      this.organizationNameFormControl.hasError('minlength') ||
      !this.data.organization.summary
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
      this.editComplete.emit({ saveChanges: false, organization: null });
    } else {
      this.data.organization.name = this.organizationNameFormControl.value
        .toString()
        .trim();
      this.data.organization.description = this.descriptionFormControl.value
        .toString()
        .trim();
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          organization: this.data.organization,
        });
      }
    }
  }

  /**
   * Saves the current organization
   */
  saveOrganization(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.organization.name = this.organizationNameFormControl.value ? this.organizationNameFormControl.value.toString() : '';
        break;
      case 'shortName':
        this.data.organization.shortName =
            this.organizationShortNameFormControl.value ? this.organizationShortNameFormControl.value.toString() : '';
        break;
      case 'description':
        this.data.organization.description = this.descriptionFormControl.value ? this.descriptionFormControl.value.toString() : '';
        break;
      case 'summary':
        this.data.organization.summary = this.summaryFormControl.value;
        break;
      case 'email':
        this.data.organization.email = this.organizationEmailFormControl.value ? this.organizationEmailFormControl.value.toString() : '';
        break;
      default:
        break;
    }
  }

}
