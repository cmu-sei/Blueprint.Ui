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
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

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
    selector: 'app-organization-edit-dialog',
    templateUrl: './organization-edit-dialog.component.html',
    styleUrls: ['./organization-edit-dialog.component.scss'],
    standalone: false
})
export class OrganizationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public organizationNameFormControl = new UntypedFormControl(
    this.data.organization.name,
    [Validators.required]
  );
  public organizationShortNameFormControl = new UntypedFormControl(
    this.data.organization.shortName,
    [Validators.required]
  );
  public organizationEmailFormControl = new UntypedFormControl(
    this.data.organization.email,
    [Validators.required]
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.organization.description,
    []
  );
  public summaryFormControl = new UntypedFormControl(
    this.data.organization.summary,
    [Validators.required]
  );
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
  };

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<OrganizationEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return !(
      this.organizationNameFormControl.hasError('required') ||
      this.organizationNameFormControl.hasError('minlength') ||
      this.organizationShortNameFormControl.hasError('required') ||
      this.organizationShortNameFormControl.hasError('minlength') ||
      this.organizationEmailFormControl.hasError('required') ||
      this.organizationEmailFormControl.hasError('minlength') ||
      this.summaryFormControl.hasError('required') ||
      this.summaryFormControl.hasError('minlength')
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
        this.data.organization.name = this.organizationNameFormControl.value
          ? this.organizationNameFormControl.value.toString()
          : '';
        break;
      case 'shortName':
        this.data.organization.shortName = this.organizationShortNameFormControl
          .value
          ? this.organizationShortNameFormControl.value.toString()
          : '';
        break;
      case 'description':
        this.data.organization.description = this.descriptionFormControl.value
          ? this.descriptionFormControl.value.toString()
          : '';
        break;
      case 'summary':
        this.data.organization.summary = this.summaryFormControl.value;
        break;
      case 'email':
        this.data.organization.email = this.organizationEmailFormControl.value
          ? this.organizationEmailFormControl.value.toString()
          : '';
        break;
      default:
        break;
    }
  }
}
